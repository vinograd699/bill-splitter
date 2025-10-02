package main

import (
	"bill-splitter/handlers"
	"bill-splitter/storage"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"runtime"
	"strings"
)

func main() {
	// Инициализация хранилища и обработчиков
	store := storage.NewMemoryStorage()
	billHandler := handlers.NewBillHandler(store)

	// Получаем путь к директории frontend
	_, filename, _, _ := runtime.Caller(0)
	rootDir := filepath.Dir(filepath.Dir(filename))
	frontendDir := filepath.Join(rootDir, "frontend")

	// Middleware для CORS
	corsMiddleware := func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

			if r.Method == "OPTIONS" {
				return
			}

			next(w, r)
		}
	}

	// Сервим статические файлы
	http.Handle("/", http.FileServer(http.Dir(frontendDir)))

	// API маршруты
	http.HandleFunc("/api/bills", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			billHandler.CreateBill(w, r)
		case http.MethodGet:
			billHandler.GetAllBills(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}))

	http.HandleFunc("/api/bills/", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		id := strings.TrimPrefix(path, "/api/bills/")

		if strings.Contains(id, "/") {
			parts := strings.Split(id, "/")
			id = parts[0]
			action := parts[1]

			switch action {
			case "split":
				if r.Method == http.MethodGet {
					billHandler.CalculateSplit(w, r)
				} else {
					http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
				}
			case "items":
				if r.Method == http.MethodPost {
					billHandler.AddItemToBill(w, r)
				} else {
					http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
				}
			default:
				if r.Method == http.MethodGet {
					billHandler.GetBill(w, r)
				} else {
					http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
				}
			}
		} else {
			if r.Method == http.MethodGet {
				billHandler.GetBill(w, r)
			} else {
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
		}
	}))

	// Запуск сервера
	port := ":8080"
	fmt.Printf("Bill splitter service running on http://localhost%s\n", port)
	fmt.Printf("Frontend available at http://localhost%s\n", port)
	fmt.Println("API Endpoints:")
	fmt.Println("  POST   /api/bills - Create new bill")
	fmt.Println("  GET    /api/bills - Get all bills")
	fmt.Println("  GET    /api/bills/{id} - Get bill by ID")
	fmt.Println("  GET    /api/bills/{id}/split - Calculate bill split")
	fmt.Println("  POST   /api/bills/{id}/items - Add item to bill")

	log.Fatal(http.ListenAndServe(port, nil))
}
