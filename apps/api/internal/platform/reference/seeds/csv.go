package seeds

import (
	"bytes"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"strings"
)

// readCSV reads a seed file (lines starting with # are comments): the header,
// which must be header, then the records, each with as many fields.
func readCSV(name string, data []byte, header ...string) ([][]string, error) {
	r := csv.NewReader(bytes.NewReader(data))
	r.Comment = '#'
	r.FieldsPerRecord = len(header)
	got, err := r.Read()
	if err != nil {
		return nil, fmt.Errorf("%s header: %w", name, err)
	}
	if strings.Join(got, ",") != strings.Join(header, ",") {
		return nil, fmt.Errorf("%s header: got %q", name, got)
	}
	var records [][]string
	for {
		rec, err := r.Read()
		if errors.Is(err, io.EOF) {
			return records, nil
		}
		if err != nil {
			return nil, fmt.Errorf("%s: %w", name, err)
		}
		records = append(records, rec)
	}
}
