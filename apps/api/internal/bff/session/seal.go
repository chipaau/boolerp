package session

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
)

// ErrUnreadable means a sealed value cannot be opened: it was sealed with
// another key (the key was replaced) or for another session, or it was altered.
// The session then counts as signed out (C96).
var ErrUnreadable = errors.New("session: sealed value cannot be opened")

// Sealer encrypts values kept in sessions with AES-256-GCM from the standard
// library (C96). Each value gets a random nonce; the associated data binds it to
// its session's account, so a value copied into another session does not open.
type Sealer struct {
	aead cipher.AEAD
}

// NewSealer returns a sealer for a 32-byte key written as 64 hex digits.
func NewSealer(hexKey string) (*Sealer, error) {
	key, err := hex.DecodeString(hexKey)
	if err != nil || len(key) != 32 {
		return nil, errors.New("session: the encryption key must be 32 bytes as 64 hex digits")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("session: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("session: %w", err)
	}
	return &Sealer{aead: aead}, nil
}

// Seal encrypts plaintext for the session of account; the result is the nonce
// followed by the ciphertext.
func (s *Sealer) Seal(plaintext []byte, account string) []byte {
	nonce := make([]byte, s.aead.NonceSize())
	_, _ = rand.Read(nonce) // crypto/rand.Read never fails (Go 1.24+)
	return s.aead.Seal(nonce, nonce, plaintext, []byte(account))
}

// Open decrypts a value from Seal for the session of account.
func (s *Sealer) Open(sealed []byte, account string) ([]byte, error) {
	n := s.aead.NonceSize()
	if len(sealed) < n {
		return nil, ErrUnreadable
	}
	plaintext, err := s.aead.Open(nil, sealed[:n], sealed[n:], []byte(account))
	if err != nil {
		return nil, ErrUnreadable
	}
	return plaintext, nil
}
