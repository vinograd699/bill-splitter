package handlers

import (
	"bill-splitter/models"
	"bill-splitter/storage"
	"encoding/json"
	"net/http"
	"regexp"
	"strconv"
	"strings"
)

type ReceiptHandler struct {
	storage *storage.MemoryStorage
}

func NewReceiptHandler(storage *storage.MemoryStorage) *ReceiptHandler {
	return &ReceiptHandler{
		storage: storage,
	}
}

type ParseReceiptRequest struct {
	Text string `json:"text"`
}

type ParseReceiptResponse struct {
	Items    []models.Item `json:"items"`
	Total    float64       `json:"total"`
	Currency string        `json:"currency,omitempty"`
}

func (h *ReceiptHandler) ParseReceipt(w http.ResponseWriter, r *http.Request) {
	var req ParseReceiptRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	items, total, currency := h.parseReceiptText(req.Text)

	response := ParseReceiptResponse{
		Items:    items,
		Total:    total,
		Currency: currency,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *ReceiptHandler) parseReceiptText(text string) ([]models.Item, float64, string) {
	lines := strings.Split(text, "\n")
	var items []models.Item
	total := 0.0
	currency := "RUB"

	// Определяем валюту по символам в тексте
	if strings.Contains(text, "$") {
		currency = "USD"
	} else if strings.Contains(text, "€") {
		currency = "EUR"
	} else if strings.Contains(text, "£") {
		currency = "GBP"
	}

	for i, line := range lines {
		line = strings.TrimSpace(line)
		if h.isReceiptHeader(line) || h.isTotalLine(line) {
			continue
		}

		// Парсим цену и название
		price, name := h.extractPriceAndName(line)
		if price > 0 && name != "" && h.isValidItemName(name) {
			items = append(items, models.Item{
				ID:    "receipt_" + strconv.Itoa(i+1),
				Name:  name,
				Price: price,
			})
			total += price
		}
	}

	return items, total, currency
}

func (h *ReceiptHandler) isReceiptHeader(line string) bool {
	headers := []string{
		"чек", "чек №", "date", "дата", "время", "time",
		"касса", "смена", "оператор", "order", "заказ",
		"фискальный", "фн", "фд", "фпд", "регистратор",
		"наименование", "цена", "кол-во", "сумма",
	}
	lower := strings.ToLower(line)
	for _, header := range headers {
		if strings.Contains(lower, header) {
			return true
		}
	}
	return false
}

func (h *ReceiptHandler) isTotalLine(line string) bool {
	totals := []string{
		"итого", "всего", "total", "сумма", "оплата",
		"налог", "ндс", "сдача", "change", "внесено",
		"наличными", "картой", "cash", "card", "credit",
	}
	lower := strings.ToLower(line)
	for _, total := range totals {
		if strings.Contains(lower, total) {
			return true
		}
	}
	return false
}

func (h *ReceiptHandler) extractPriceAndName(line string) (float64, string) {
	// Регулярные выражения для поиска цен в разных форматах
	patterns := []string{
		`(\d+[.,]\d{2})\s*$`,       // 123.45 в конце строки
		`\s(\d+[.,]\d{2})\s`,       // 123.45 в середине
		`\s(\d+)[.,]?(\d{2})?\s*$`, // 123 или 123.45 в конце
		`[x×*]\s*(\d+[.,]\d{2})`,   // x 123.45
		`[x×*]\s*(\d+)`,            // x 123
		`\s(\d+)\s*р`,              // 123 р
		`\s(\d+)\s*руб`,            // 123 руб
		`\s(\d+)\s*₽`,              // 123 ₽
		`\$(\d+[.,]\d{2})`,         // $123.45
		`\€(\d+[.,]\d{2})`,         // €123.45
		`\£(\d+[.,]\d{2})`,         // £123.45
	}

	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		matches := re.FindStringSubmatch(line)
		if len(matches) > 0 {
			priceStr := matches[1]
			// Если есть вторая группа для копеек (шаблон \s(\d+)[.,]?(\d{2})?\s*$)
			if len(matches) > 2 && matches[2] != "" {
				priceStr = priceStr + "." + matches[2]
			}

			priceStr = strings.Replace(priceStr, ",", ".", -1)
			price, err := strconv.ParseFloat(priceStr, 64)
			if err == nil {
				// Извлекаем название, убирая цену из строки
				name := strings.TrimSpace(re.ReplaceAllString(line, ""))
				name = h.cleanItemName(name)
				if name != "" {
					return price, name
				}
			}
		}
	}

	return 0, ""
}

func (h *ReceiptHandler) isValidItemName(name string) bool {
	// Пропускаем слишком короткие названия и числа
	if len(name) < 2 {
		return false
	}

	// Пропускаем строки, состоящие только из цифр и знаков препинания
	if matched, _ := regexp.MatchString(`^[0-9\s.,-]+$`, name); matched {
		return false
	}

	// Пропускаем служебные слова
	invalidWords := []string{"шт", "kg", "кг", "pcs", "уп", "упак", "пак", "набор", "компл"}
	lowerName := strings.ToLower(name)
	for _, word := range invalidWords {
		if strings.HasPrefix(lowerName, word) {
			return false
		}
	}

	return true
}

func (h *ReceiptHandler) cleanItemName(name string) string {
	// Убираем количественные показатели в начале
	re := regexp.MustCompile(`^\d+[.,]?\\d*[x×*]\s*`)
	name = re.ReplaceAllString(name, "")

	// Убираем специальные символы, кроме букв, цифр, пробелов и дефисов
	re = regexp.MustCompile(`[^a-zA-Zа-яА-Я0-9\s\-]`)
	name = re.ReplaceAllString(name, "")

	// Убираем лишние пробелы
	name = strings.TrimSpace(name)
	re = regexp.MustCompile(`\\s+`)
	name = re.ReplaceAllString(name, " ")

	return name
}
