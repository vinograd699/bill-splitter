package storage

import (
	"bill-splitter/models"
	"errors"
	"sync"
)

var (
	ErrBillNotFound = errors.New("bill not found")
)

type MemoryStorage struct {
	bills map[string]*models.Bill
	mu    sync.RWMutex
}

func NewMemoryStorage() *MemoryStorage {
	return &MemoryStorage{
		bills: make(map[string]*models.Bill),
	}
}

func (s *MemoryStorage) CreateBill(bill *models.Bill) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.bills[bill.ID] = bill
	return nil
}

func (s *MemoryStorage) GetBill(id string) (*models.Bill, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	bill, exists := s.bills[id]
	if !exists {
		return nil, ErrBillNotFound
	}
	return bill, nil
}

func (s *MemoryStorage) UpdateBill(bill *models.Bill) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.bills[bill.ID]; !exists {
		return ErrBillNotFound
	}

	s.bills[bill.ID] = bill
	return nil
}

func (s *MemoryStorage) DeleteBill(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.bills[id]; !exists {
		return ErrBillNotFound
	}

	delete(s.bills, id)
	return nil
}

func (s *MemoryStorage) GetAllBills() ([]*models.Bill, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	bills := make([]*models.Bill, 0, len(s.bills))
	for _, bill := range s.bills {
		bills = append(bills, bill)
	}
	return bills, nil
}
