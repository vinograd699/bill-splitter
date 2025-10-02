package models

import (
	"time"
)

// Bill представляет счет для разделения
type Bill struct {
	ID           string        `json:"id"`
	Title        string        `json:"title"`
	Description  string        `json:"description,omitempty"`
	Items        []Item        `json:"items"`
	Participants []Participant `json:"participants"`
	Tax          float64       `json:"tax"`      // налог в процентах
	Tip          float64       `json:"tip"`      // чаевые в процентах
	Currency     string        `json:"currency"` // валюта
	CreatedAt    time.Time     `json:"created_at"`
	CreatedBy    string        `json:"created_by"`
}

// Item представляет позицию в счете
type Item struct {
	ID         string   `json:"id"`
	Name       string   `json:"name"`
	Price      float64  `json:"price"`
	ConsumedBy []string `json:"consumed_by"` // ID участников, которые потребляли этот item
}

// Participant представляет участника
type Participant struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email,omitempty"`
}

// BillSummary представляет результат расчета
type BillSummary struct {
	BillID      string             `json:"bill_id"`
	TotalAmount float64            `json:"total_amount"`
	TaxAmount   float64            `json:"tax_amount"`
	TipAmount   float64            `json:"tip_amount"`
	GrandTotal  float64            `json:"grand_total"`
	Split       []ParticipantSplit `json:"split"`
	Currency    string             `json:"currency"` // ДОБАВЛЕНО ЭТО ПОЛЕ
}

// ParticipantSplit представляет долю участника
type ParticipantSplit struct {
	ParticipantID   string  `json:"participant_id"`
	ParticipantName string  `json:"participant_name"`
	Subtotal        float64 `json:"subtotal"`  // сумма до налога и чаевых
	TaxShare        float64 `json:"tax_share"` // доля налога
	TipShare        float64 `json:"tip_share"` // доля чаевых
	Total           float64 `json:"total"`     // итого к оплате
}

// CreateBillRequest запрос на создание счета
type CreateBillRequest struct {
	Title        string        `json:"title" binding:"required"`
	Description  string        `json:"description"`
	Items        []Item        `json:"items" binding:"required"`
	Participants []Participant `json:"participants" binding:"required"`
	Tax          float64       `json:"tax"`
	Tip          float64       `json:"tip"`
	Currency     string        `json:"currency"`
	CreatedBy    string        `json:"created_by"`
}

// AddItemRequest запрос на добавление позиции
type AddItemRequest struct {
	Name       string   `json:"name" binding:"required"`
	Price      float64  `json:"price" binding:"required"`
	ConsumedBy []string `json:"consumed_by" binding:"required"`
}
