package handlers

import (
	"bill-splitter/models"
	"bill-splitter/storage"
	"encoding/json"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
)

type BillHandler struct {
	storage *storage.MemoryStorage
}

func NewBillHandler(storage *storage.MemoryStorage) *BillHandler {
	return &BillHandler{
		storage: storage,
	}
}

// CreateBill создает новый счет
func (h *BillHandler) CreateBill(w http.ResponseWriter, r *http.Request) {
	var req models.CreateBillRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Валидация обязательных полей
	if strings.TrimSpace(req.Title) == "" {
		http.Error(w, "Title is required", http.StatusBadRequest)
		return
	}

	if len(req.Items) == 0 {
		http.Error(w, "At least one item is required", http.StatusBadRequest)
		return
	}

	if len(req.Participants) == 0 {
		http.Error(w, "At least one participant is required", http.StatusBadRequest)
		return
	}

	// Валидация цен товаров
	for i, item := range req.Items {
		if item.Price < 0 {
			http.Error(w, "Item price cannot be negative", http.StatusBadRequest)
			return
		}
		// Проверяем название товара
		if strings.TrimSpace(item.Name) == "" {
			http.Error(w, "Item name cannot be empty", http.StatusBadRequest)
			return
		}
		// Убедимся, что у товара есть потребители
		if len(item.ConsumedBy) == 0 && len(req.Participants) > 0 {
			// По умолчанию добавляем всех участников
			for _, participant := range req.Participants {
				req.Items[i].ConsumedBy = append(req.Items[i].ConsumedBy, participant.ID)
			}
		}
	}

	// Валидация чаевых
	if req.Tip < 0 {
		req.Tip = 0
	}

	// Генерируем ID для участников, если не предоставлены
	for i := range req.Participants {
		if req.Participants[i].ID == "" {
			req.Participants[i].ID = "participant_" + uuid.New().String()
		}
		// Убедимся, что имя участника не пустое
		if strings.TrimSpace(req.Participants[i].Name) == "" {
			req.Participants[i].Name = "Participant " + string(rune(i+1))
		}
	}

	// Генерируем ID для товаров, если не предоставлены
	for i := range req.Items {
		if req.Items[i].ID == "" {
			req.Items[i].ID = "item_" + uuid.New().String()
		}
	}

	// Устанавливаем валюту по умолчанию, если не указана
	if req.Currency == "" {
		req.Currency = "RUB"
	}

	bill := &models.Bill{
		ID:           "bill_" + uuid.New().String(),
		Title:        strings.TrimSpace(req.Title),
		Description:  strings.TrimSpace(req.Description),
		Items:        req.Items,
		Participants: req.Participants,
		Tip:          req.Tip,
		Currency:     req.Currency,
		CreatedAt:    time.Now(),
		CreatedBy:    strings.TrimSpace(req.CreatedBy),
	}

	if bill.CreatedBy == "" {
		bill.CreatedBy = "Anonymous"
	}

	if err := h.storage.CreateBill(bill); err != nil {
		http.Error(w, "Failed to create bill: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(bill); err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}

// GetBill возвращает счет по ID
func (h *BillHandler) GetBill(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	id := strings.TrimPrefix(path, "/api/bills/")

	// Убираем возможные действия из ID
	if strings.Contains(id, "/") {
		id = strings.Split(id, "/")[0]
	}

	if id == "" {
		http.Error(w, "Bill ID is required", http.StatusBadRequest)
		return
	}

	bill, err := h.storage.GetBill(id)
	if err != nil {
		if err.Error() == "bill not found" {
			http.Error(w, "Bill not found", http.StatusNotFound)
		} else {
			http.Error(w, "Failed to get bill: "+err.Error(), http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(bill); err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}

// CalculateSplit рассчитывает разделение счета
func (h *BillHandler) CalculateSplit(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	id := strings.TrimPrefix(path, "/api/bills/")
	id = strings.TrimSuffix(id, "/split")

	if strings.Contains(id, "/") {
		id = strings.Split(id, "/")[0]
	}

	if id == "" {
		http.Error(w, "Bill ID is required", http.StatusBadRequest)
		return
	}

	bill, err := h.storage.GetBill(id)
	if err != nil {
		if err.Error() == "bill not found" {
			http.Error(w, "Bill not found", http.StatusNotFound)
		} else {
			http.Error(w, "Failed to get bill: "+err.Error(), http.StatusInternalServerError)
		}
		return
	}

	summary := h.calculateBillSplit(bill)

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(summary); err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}

// calculateBillSplit основная логика расчета разделения счета
func (h *BillHandler) calculateBillSplit(bill *models.Bill) *models.BillSummary {
	// Считаем сумму по товарам
	itemsSubtotal := 0.0
	for _, item := range bill.Items {
		itemsSubtotal += item.Price
	}

	// Считаем чаевые
	tipAmount := itemsSubtotal * (bill.Tip / 100)
	grandTotal := itemsSubtotal + tipAmount

	// Создаем мапы для быстрого доступа к данным участников
	participantShares := make(map[string]float64) // Доли участников за товары
	participantNames := make(map[string]string)   // Имена участников

	// Инициализируем мапы
	for _, participant := range bill.Participants {
		participantNames[participant.ID] = participant.Name
		participantShares[participant.ID] = 0.0
	}

	// Распределяем стоимость товаров между участниками
	for _, item := range bill.Items {
		if len(item.ConsumedBy) == 0 {
			continue // Пропускаем товары без потребителей
		}

		// Стоимость на одного потребителя
		sharePerPerson := item.Price / float64(len(item.ConsumedBy))

		// Распределяем стоимость между потребителями
		for _, participantID := range item.ConsumedBy {
			if share, exists := participantShares[participantID]; exists {
				participantShares[participantID] = share + sharePerPerson
			}
		}
	}

	// Считаем общую распределенную сумму для пропорционального расчета
	totalDistributed := 0.0
	for _, share := range participantShares {
		totalDistributed += share
	}

	// Создаем результат расчета
	split := make([]models.ParticipantSplit, 0, len(bill.Participants))

	for _, participant := range bill.Participants {
		subtotal := participantShares[participant.ID]

		// Распределяем чаевые пропорционально доле участника
		var tipShare float64
		if totalDistributed > 0 && subtotal > 0 {
			ratio := subtotal / totalDistributed
			tipShare = tipAmount * ratio
		}

		total := subtotal + tipShare

		// Округляем до 2 знаков после запятой
		subtotal = math.Round(subtotal*100) / 100
		tipShare = math.Round(tipShare*100) / 100
		total = math.Round(total*100) / 100

		split = append(split, models.ParticipantSplit{
			ParticipantID:   participant.ID,
			ParticipantName: participant.Name,
			Subtotal:        subtotal,
			TipShare:        tipShare,
			Total:           total,
		})
	}

	// Округляем итоговые суммы
	itemsSubtotal = math.Round(itemsSubtotal*100) / 100
	tipAmount = math.Round(tipAmount*100) / 100
	grandTotal = math.Round(grandTotal*100) / 100

	return &models.BillSummary{
		BillID:      bill.ID,
		TotalAmount: itemsSubtotal,
		TipAmount:   tipAmount,
		GrandTotal:  grandTotal,
		Split:       split,
		Currency:    bill.Currency,
	}
}

// AddItemToBill добавляет позицию в существующий счет
func (h *BillHandler) AddItemToBill(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	id := strings.TrimPrefix(path, "/api/bills/")
	id = strings.TrimSuffix(id, "/items")

	if strings.Contains(id, "/") {
		id = strings.Split(id, "/")[0]
	}

	if id == "" {
		http.Error(w, "Bill ID is required", http.StatusBadRequest)
		return
	}

	bill, err := h.storage.GetBill(id)
	if err != nil {
		if err.Error() == "bill not found" {
			http.Error(w, "Bill not found", http.StatusNotFound)
		} else {
			http.Error(w, "Failed to get bill: "+err.Error(), http.StatusInternalServerError)
		}
		return
	}

	var req models.AddItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Валидация данных товара
	if strings.TrimSpace(req.Name) == "" {
		http.Error(w, "Item name is required", http.StatusBadRequest)
		return
	}

	if req.Price < 0 {
		http.Error(w, "Item price cannot be negative", http.StatusBadRequest)
		return
	}

	if len(req.ConsumedBy) == 0 {
		http.Error(w, "At least one consumer is required", http.StatusBadRequest)
		return
	}

	// Проверяем, что все указанные участники существуют
	participantMap := make(map[string]bool)
	for _, p := range bill.Participants {
		participantMap[p.ID] = true
	}

	for _, participantID := range req.ConsumedBy {
		if !participantMap[participantID] {
			http.Error(w, "Participant not found: "+participantID, http.StatusBadRequest)
			return
		}
	}

	// Создаем новый товар
	newItem := models.Item{
		ID:         "item_" + uuid.New().String(),
		Name:       strings.TrimSpace(req.Name),
		Price:      req.Price,
		ConsumedBy: req.ConsumedBy,
	}

	// Добавляем товар в счет
	bill.Items = append(bill.Items, newItem)

	// Обновляем счет в хранилище
	if err := h.storage.UpdateBill(bill); err != nil {
		http.Error(w, "Failed to update bill: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(bill); err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}

// GetAllBills возвращает все счета
func (h *BillHandler) GetAllBills(w http.ResponseWriter, r *http.Request) {
	bills, err := h.storage.GetAllBills()
	if err != nil {
		http.Error(w, "Failed to get bills: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Если счетов нет, возвращаем пустой массив вместо nil
	if bills == nil {
		bills = []*models.Bill{}
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(bills); err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}

// DeleteBill удаляет счет
func (h *BillHandler) DeleteBill(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	id := strings.TrimPrefix(path, "/api/bills/")

	if strings.Contains(id, "/") {
		id = strings.Split(id, "/")[0]
	}

	if id == "" {
		http.Error(w, "Bill ID is required", http.StatusBadRequest)
		return
	}

	if err := h.storage.DeleteBill(id); err != nil {
		if err.Error() == "bill not found" {
			http.Error(w, "Bill not found", http.StatusNotFound)
		} else {
			http.Error(w, "Failed to delete bill: "+err.Error(), http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	response := map[string]string{
		"message": "Bill deleted successfully",
		"bill_id": id,
	}
	if err := json.NewEncoder(w).Encode(response); err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}
