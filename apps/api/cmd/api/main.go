package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/boolmv/erp/internal/bootstrap"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := bootstrap.Run(ctx); err != nil {
		log.Print(err)
		os.Exit(1)
	}
}
