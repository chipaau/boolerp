package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"syscall"
	"testing"
	"time"
)

// Run the real entry point in a subprocess so exit codes and signals are tested
// without terminating the test runner or relying on its environment settings.
func TestMain(m *testing.M) {
	if os.Getenv("BOOL_API_TEST_PROCESS") == "1" {
		main()
		return
	}
	os.Exit(m.Run())
}

func apiCommand(t *testing.T, settings ...string) *exec.Cmd {
	t.Helper()
	executable, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
	t.Cleanup(cancel)
	cmd := exec.CommandContext(ctx, executable)
	cmd.Env = append([]string{
		"BOOL_API_TEST_PROCESS=1",
		"APP_DSN=postgres://user:reserved-secret@unused/database",
		"APP_REDIS_URL=redis://:reserved-secret@unused",
	}, settings...)
	return cmd
}

func records(t *testing.T, output []byte) []map[string]any {
	t.Helper()
	if bytes.Contains(output, []byte("reserved-secret")) || bytes.Contains(output, []byte("invalid-secret")) {
		t.Fatal("process logs exposed an environment value")
	}
	var result []map[string]any
	decoder := json.NewDecoder(bytes.NewReader(output))
	for {
		var record map[string]any
		err := decoder.Decode(&record)
		if err == io.EOF {
			return result
		}
		if err != nil {
			t.Fatalf("invalid structured log: %v", err)
		}
		result = append(result, record)
	}
}

func TestInvalidConfigurationExitsWithSafeJSON(t *testing.T) {
	for _, key := range []string{
		"APP_ENV", "APP_PORT", "APP_SHUTDOWN_TIMEOUT", "APP_LOG_FORMAT", "APP_LOG_LEVEL",
		"APP_HTTP_MAX_BODY_BYTES", "APP_HTTP_READ_HEADER_TIMEOUT", "APP_HTTP_READ_TIMEOUT",
		"APP_HTTP_WRITE_TIMEOUT", "APP_HTTP_IDLE_TIMEOUT",
	} {
		t.Run(key, func(t *testing.T) {
			cmd := apiCommand(t, key+"=invalid-secret")
			output, err := cmd.Output()
			exit, ok := err.(*exec.ExitError)
			if !ok || exit.ExitCode() != 1 || len(exit.Stderr) != 0 {
				t.Fatalf("expected exit code 1 with errors on stdout, got %v", err)
			}
			logs := records(t, output)
			if len(logs) != 1 || logs[0]["level"] != "ERROR" || logs[0]["msg"] != "Invalid configuration" {
				t.Fatalf("expected one structured configuration error, got %v", logs)
			}
			if !strings.Contains(fmt.Sprint(logs[0]["error"]), key) {
				t.Fatalf("error did not identify %s", key)
			}
		})
	}
}

func availablePort(t *testing.T) int {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := listener.Addr().(*net.TCPAddr).Port
	if err := listener.Close(); err != nil {
		t.Fatal(err)
	}
	return port
}

func TestAPILifecycle(t *testing.T) {
	port := availablePort(t)
	cmd := apiCommand(t, "APP_ENV=test", fmt.Sprintf("APP_PORT=%d", port), "APP_SHUTDOWN_TIMEOUT=250ms")
	var output, stderr bytes.Buffer
	cmd.Stdout = &output
	cmd.Stderr = &stderr
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	done := make(chan struct{})
	var exitErr error
	go func() {
		exitErr = cmd.Wait()
		close(done)
	}()
	t.Cleanup(func() {
		_ = cmd.Process.Kill()
		<-done
	})

	client := &http.Client{Timeout: 100 * time.Millisecond}
	defer client.CloseIdleConnections()
	url := fmt.Sprintf("http://127.0.0.1:%d/api/healthz", port)
	healthy := false
	for deadline := time.Now().Add(5 * time.Second); time.Now().Before(deadline); {
		select {
		case <-done:
			t.Fatalf("API stopped before becoming healthy: %v; %s", exitErr, output.String())
		default:
		}
		response, err := client.Get(url)
		if err == nil {
			body, readErr := io.ReadAll(response.Body)
			response.Body.Close()
			if readErr != nil || response.StatusCode != http.StatusOK || strings.TrimSpace(string(body)) != `{"status":"ok"}` {
				t.Fatalf("unexpected health response: status=%d body=%q error=%v", response.StatusCode, body, readErr)
			}
			healthy = true
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	if !healthy {
		t.Fatal("API did not become healthy")
	}

	// A second process must fail clearly when it cannot acquire the same port.
	conflict := apiCommand(t, fmt.Sprintf("APP_PORT=%d", port), "APP_LOG_LEVEL=error")
	conflictOutput, err := conflict.Output()
	conflictExit, ok := err.(*exec.ExitError)
	if !ok || conflictExit.ExitCode() != 1 || len(conflictExit.Stderr) != 0 {
		t.Fatalf("expected exit code 1 for an occupied port, got %v", err)
	}
	conflictLogs := records(t, conflictOutput)
	if len(conflictLogs) != 1 || conflictLogs[0]["level"] != "ERROR" || conflictLogs[0]["msg"] != "API failed" {
		t.Fatalf("expected a structured startup failure, got %v", conflictLogs)
	}

	if err := cmd.Process.Signal(syscall.SIGTERM); err != nil {
		t.Fatal(err)
	}
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("API did not stop after SIGTERM")
	}
	if exitErr != nil || stderr.Len() != 0 {
		t.Fatalf("shutdown error: %v; stderr: %s", exitErr, stderr.String())
	}
	logs := records(t, output.Bytes())
	var lifecycle []map[string]any
	for _, record := range logs {
		if record["msg"] != "HTTP request completed" {
			lifecycle = append(lifecycle, record)
		}
	}
	if len(lifecycle) != 3 || lifecycle[0]["msg"] != "HTTP server started" || lifecycle[1]["msg"] != "HTTP server stopping" || lifecycle[2]["msg"] != "API stopped" {
		t.Fatalf("unexpected lifecycle logs: %v", logs)
	}
	if lifecycle[1]["timeout"] != "250ms" {
		t.Fatalf("shutdown timeout was not configured: %v", lifecycle[1])
	}
	for _, record := range logs {
		if record["service"] != "api" || record["environment"] != "test" {
			t.Fatalf("missing process context: %v", record)
		}
	}
}

func TestSecondSignalInterruptsShutdown(t *testing.T) {
	port := availablePort(t)
	cmd := apiCommand(t, fmt.Sprintf("APP_PORT=%d", port), "APP_SHUTDOWN_TIMEOUT=30s")
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		t.Fatal(err)
	}
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = cmd.Process.Kill()
		_ = cmd.Wait()
	})
	scanner := bufio.NewScanner(stdout)
	if !scanner.Scan() || !strings.Contains(scanner.Text(), "HTTP server started") {
		t.Fatal("API did not report startup")
	}

	// Keep an incomplete request open. A second health request confirms the
	// accept loop has taken the first connection before shutdown begins.
	address := fmt.Sprintf("127.0.0.1:%d", port)
	connection, err := net.DialTimeout("tcp", address, time.Second)
	if err != nil {
		t.Fatal(err)
	}
	defer connection.Close()
	if _, err := io.WriteString(connection, "GET /api/healthz HTTP/1.1\r\nHost: localhost\r\n"); err != nil {
		t.Fatal(err)
	}
	client := &http.Client{Timeout: time.Second}
	defer client.CloseIdleConnections()
	response, err := client.Get("http://" + address + "/api/healthz")
	if err != nil {
		t.Fatal(err)
	}
	io.Copy(io.Discard, response.Body)
	response.Body.Close()
	if response.StatusCode != http.StatusOK {
		t.Fatalf("health status: %d", response.StatusCode)
	}

	if err := cmd.Process.Signal(syscall.SIGTERM); err != nil {
		t.Fatal(err)
	}
	for scanner.Scan() && strings.Contains(scanner.Text(), "HTTP request completed") {
	}
	if !strings.Contains(scanner.Text(), "HTTP server stopping") {
		t.Fatal("API did not begin graceful shutdown")
	}
	if err := cmd.Process.Signal(os.Interrupt); err != nil {
		t.Fatal(err)
	}
	for scanner.Scan() {
		t.Errorf("unexpected log during forced shutdown: %s", scanner.Text())
	}
	if err := scanner.Err(); err != nil {
		t.Fatal(err)
	}
	err = cmd.Wait()
	exit, ok := err.(*exec.ExitError)
	if !ok {
		t.Fatalf("expected termination by SIGINT, got %v", err)
	}
	status, ok := exit.Sys().(syscall.WaitStatus)
	if !ok || !status.Signaled() || status.Signal() != syscall.SIGINT {
		t.Fatalf("second signal did not terminate the API: %v", err)
	}
}
