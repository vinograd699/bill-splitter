// backend/main.go
package main

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
)

func main() {
	const token = "36760.XTUcy2f6NnuU2W9gr"

	if token == "" {
		log.Fatal("❌ Ошибка: токен не установлен")
	}
	log.Println("✅ Токен загружен (для отладки)")

	http.HandleFunc("GET /api/bills", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"bills":[]}`)
	})

	http.HandleFunc("POST /api/bills", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"id":"1", "title":"Новый счёт"}`)
	})

	http.HandleFunc("POST /api/check", func(w http.ResponseWriter, r *http.Request) {
		log.Println("✅ Получен запрос: POST /api/check")

		fn := strings.TrimSpace(r.FormValue("fn"))
		fd := strings.TrimSpace(r.FormValue("fd"))
		fp := strings.TrimSpace(r.FormValue("fp"))
		t := strings.TrimSpace(r.FormValue("t"))
		s := strings.TrimSpace(r.FormValue("s"))
		n := strings.TrimSpace(r.FormValue("n"))

		if fn == "" || fd == "" || fp == "" || t == "" || s == "" {
			log.Println("❌ Не хватает параметров")
			http.Error(w, "Missing required parameters", http.StatusBadRequest)
			return
		}

		if len(t) > 13 && t[13] >= '0' && t[13] <= '9' {
			t = t[:13]
		}

		s = strings.TrimSpace(strings.ReplaceAll(s, ",", "."))
		if _, err := strconv.ParseFloat(s, 64); err != nil {
			log.Printf("❌ Некорректная сумма: %s", s)
			http.Error(w, "Invalid sum format", http.StatusBadRequest)
			return
		}

		log.Printf("🔧 Параметры: fn=%s, fd=%s, fp=%s, t=%s, s=%s, n=%s", fn, fd, fp, t, s, n)

		data := url.Values{}
		data.Set("fn", fn)
		data.Set("fd", fd)
		data.Set("fp", fp)
		data.Set("t", t)
		data.Set("s", s)
		data.Set("n", n)
		data.Set("qr", "1")
		data.Set("token", token)

		log.Printf("📤 Отправка: %s", data.Encode())

		req, err := http.NewRequest("POST", "https://proverkacheka.com/api/v1/check/get",
			strings.NewReader(data.Encode()))
		if err != nil {
			http.Error(w, "Request failed", http.StatusInternalServerError)
			return
		}

		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		req.Header.Set("User-Agent", "BillSplitter/1.0")

		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			http.Error(w, "Failed to reach proverkacheka", http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()

		log.Printf("📩 Статус: %d %s", resp.StatusCode, resp.Status)

		for k, vv := range resp.Header {
			for _, v := range vv {
				w.Header().Add(k, v)
			}
		}
		w.WriteHeader(resp.StatusCode)
		io.Copy(w, resp.Body)
	})

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		filePath := "../frontend" + r.URL.Path
		if r.URL.Path != "/" {
			if _, err := os.Stat(filePath); os.IsNotExist(err) {
				http.NotFound(w, r)
				return
			}
			http.ServeFile(w, r, filePath)
			return
		}
		http.ServeFile(w, r, "../frontend/index.html")
	})

	if _, err := os.Stat("../frontend/index.html"); os.IsNotExist(err) {
		log.Fatal("❌ ../frontend/index.html не найден!")
	}

	port := "3000"
	fmt.Printf("✅ Сервер запущен на http://localhost:%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
