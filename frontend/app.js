// frontend/app.js — Полная рабочая версия
// Платим вместе — Разделение счёта

document.addEventListener('DOMContentLoaded', function () {
    console.log('✅ DOM загружен — инициализация приложения');

    // --- 1. ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ---
    function setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        // Изначально скрываем все, кроме активной
        tabContents.forEach(tab => {
            tab.style.display = tab.classList.contains('active') ? 'block' : 'none';
        });

        tabButtons.forEach(button => {
            button.addEventListener('click', function () {
                const tabName = this.dataset.tab;
                console.log('📌 Переключение на вкладку:', tabName);

                // Обновляем кнопки
                tabButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');

                // Скрываем все вкладки
                tabContents.forEach(tab => {
                    tab.style.display = 'none';
                });

                // Показываем нужную
                const targetTab = document.getElementById(`${tabName}-tab`);
                if (targetTab) {
                    targetTab.style.display = 'block';
                } else {
                    console.error('❌ Вкладка не найдена:', `${tabName}-tab`);
                }
            });
        });
    }

    // --- 2. УЧАСТНИКИ ---
    window.addParticipant = function () {
        const container = document.getElementById('participants-container');
        const count = container.children.length + 1;

        const el = document.createElement('div');
        el.className = 'participant';
        el.innerHTML = `
            <input type="text" class="participant-name" value="Участник ${count}" required>
            <button type="button" class="remove-participant" onclick="removeParticipant(this)">×</button>
        `;
        container.appendChild(el);

        // Обновляем чекбоксы у товаров
        el.querySelector('.participant-name').addEventListener('input', updateConsumerCheckboxes);
        updateConsumerCheckboxes();
    };

    window.removeParticipant = function (button) {
        button.closest('.participant').remove();
        updateConsumerCheckboxes();
    };

    function updateConsumerCheckboxes() {
        const participants = Array.from(document.querySelectorAll('#participants-container .participant'))
            .map(p => p.querySelector('.participant-name').value.trim())
            .filter(name => name);

        document.querySelectorAll('.item-consumers').forEach(container => {
            container.innerHTML = participants.map(name => `
                <label><input type="checkbox" checked> ${escapeHtml(name)}</label>
            `).join('');
        });
    }

    // --- 3. СКАНИРОВАНИЕ QR-КОДА ---
    function setupQRScanner() {
        const scanButton = document.getElementById('scan-qr');
        if (!scanButton) {
            console.error('❌ Элемент #scan-qr не найден');
            return;
        }

        scanButton.addEventListener('click', async () => {
            console.log('📸 Кнопка "Сканировать QR-код" нажата');

            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                console.log('✅ Доступ к камере получен');

                const video = document.createElement('video');
                video.srcObject = stream;
                video.autoplay = true;
                video.playsInline = true;
                video.style.width = '100%';
                video.style.maxWidth = '400px';
                video.style.borderRadius = '12px';
                video.style.margin = '10px auto';
                video.style.display = 'block';

                const container = document.getElementById('upload-area');
                container.innerHTML = '<p style="color: #0071e3; margin: 10px 0;">🔍 Наведите камеру на QR-код</p>';
                container.appendChild(video);

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d', { willReadFrequently: true });

                const scanLoop = setInterval(() => {
                    if (video.videoWidth === 0) return;

                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                    if (typeof jsQR === 'undefined') {
                        console.warn('🟡 Ожидание загрузки jsQR...');
                        return;
                    }

                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const code = jsQR(imageData.data, canvas.width, canvas.height);

                    if (code) {
                        clearInterval(scanLoop);
                        stopStream(stream);
                        console.log('✅ QR-код распознан:', code.data);
                        parseQRUrl(code.data);
                    }
                }, 500);

            } catch (err) {
                console.error('❌ Ошибка камеры:', err);
                let errorMsg = 'Неизвестная ошибка';
                if (err.name === 'NotAllowedError') {
                    errorMsg = '❌ Доступ к камере запрещён';
                } else if (err.name === 'NotFoundError') {
                    errorMsg = '❌ Камера не найдена';
                } else if (err.name === 'NotReadableError') {
                    errorMsg = '❌ Камера занята (например, другим приложением)';
                } else if (err.name === 'NotSupportedError') {
                    errorMsg = '❌ Требуется безопасное соединение (HTTPS или localhost)';
                }

                document.getElementById('upload-area').innerHTML = `<p style="color: red;">${errorMsg}</p>`;
                alert(errorMsg);
            }
        });
    }

    // Остановка видео-потока
    function stopStream(stream) {
        stream.getTracks().forEach(track => track.stop());
    }

    // Разбор QR-URL (из чека)
    function parseQRUrl(qrData) {
        console.log('📝 Обработка QR-данных:', qrData);

        try {
            // Поддержка разных форматов: URL или "t=...&fn=..."
            const raw = qrData.includes('?') ? qrData.split('?')[1] : qrData;
            const params = new URLSearchParams(raw);

            const fn = params.get('fn');
            const i = params.get('i') || params.get('fd');
            const fp = params.get('fp');
            const t = params.get('t');
            const s = params.get('s');

            if (!fn || !i || !fp || !t || !s) {
                alert('❌ QR-код не содержит необходимых данных');
                console.warn('Отсутствуют параметры:', { fn, i, fp, t, s });
                return;
            }

            // Обрезаем t, если слишком длинный
            const formattedT = t.length > 13 ? t.substring(0, 13) : t;

            // Попробуем запросить чек с сервера
            fetchCheckFromAPI(fn, i, fp, formattedT, s);
        } catch (err) {
            console.error('❌ Ошибка парсинга QR:', err);
            alert('❌ Не удалось распознать QR-код');
        }
    }

    // Запрос к серверу для получения чека
    async function fetchCheckFromAPI(fn, fd, fp, t, s) {
        const container = document.getElementById('upload-area');
        container.innerHTML = '<div class="loading">📥 Получение чека...</div>';

        try {
            const response = await fetch('http://localhost:3000/api/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ fn, fd, fp, t, s })
            });

            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                alert('❌ Ответ сервера не JSON');
                container.innerHTML = '<p>❌ Ошибка ответа</p>';
                return;
            }

            if (data.code !== 1 || !data.data?.json) {
                throw new Error(data.msg || 'Чек не найден');
            }

            const items = data.data.json.items.map(item => ({
                name: item.name.trim(),
                price: parseFloat((item.price / 100).toFixed(2)),
                quantity: item.quantity
            }));

            fillItemsFromCheck(items);
            showNotification('✅ Чек загружен', 'success');
            container.innerHTML = '<p style="color: green;">✅ Чек успешно загружен</p>';

        } catch (err) {
            console.error('❌ Ошибка загрузки чека:', err);
            showNotification('❌ ' + err.message, 'error');
            container.innerHTML = `<p style="color: red;">❌ ${err.message}</p>`;
        }
    }

    // Заполняем товары из чека
    function fillItemsFromCheck(items) {
        const container = document.getElementById('items-container');
        container.innerHTML = '';

        items.forEach(item => {
            const total = (item.price * item.quantity).toFixed(2);
            const el = document.createElement('div');
            el.className = 'item';
            el.innerHTML = `
                <input type="text" class="item-name" value="${escapeHtml(item.name)}" required>
                <input type="number" class="item-price" value="${item.price}" step="0.01" required>
                <input type="number" class="item-quantity" value="${item.quantity}" min="1" step="1" style="width: 60px;">
                <span class="item-total"><b>= ${total} ₽</b></span>
                <div class="item-consumers"></div>
                <button type="button" class="remove-item" onclick="removeItem(this)">×</button>
            `;
            container.appendChild(el);
        });

        updateConsumerCheckboxes();
    }

    // --- 4. ПЕРЕКЛЮЧЕНИЕ ЯЗЫКА ---
    function setupLanguageSwitcher() {
        const toggle = document.getElementById('lang-toggle');
        const menu = document.getElementById('lang-menu');

        if (!toggle || !menu) {
            console.error('❌ Элементы переключателя языка не найдены');
            return;
        }

        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
        });

        document.addEventListener('click', () => {
            menu.style.display = 'none';
        });

        menu.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                const lang = e.target.dataset.lang;
                if (lang) {
                    localStorage.setItem('appLang', lang);
                    console.log('🌐 Язык изменён:', lang);
                    translatePage(lang);
                    menu.style.display = 'none';
                }
            }
        });
    }

    // Перевод интерфейса
    function translatePage(lang = localStorage.getItem('appLang') || 'ru') {
        console.log('🔄 Перевод на:', lang);

        const t = {
            ru: {
                scan: 'Сканировать чек',
                calculate: 'Рассчитать счёт',
                about: 'О проекте',
                scanPrompt: 'Загрузите чек',
                scanButton: '📷 Сканировать QR-код',
                uploadPrompt: '📁 Перетащите изображение или нажмите, чтобы выбрать',
                participants: 'Участники',
                addParticipant: '+ Добавить участника',
                items: 'Товары',
                tips: 'Чаевые',
                calculateBtn: 'Рассчитать счёт',
                result: 'Результат',
                aboutDesc1: '<strong>"Дели счёт"</strong> — это удобное приложение для разделения счёта между друзьями, семьёй или коллегами после совместной покупки или обеда.',
                aboutDesc2: 'Просто <strong>отсканируйте QR-код чека</strong> — приложение автоматически извлечёт список товаров, цены и количество. Затем укажите, кто за что платит, и <strong>"Дели счёт"</strong> рассчитает, сколько должен каждый участник.',
                aboutDesc3: 'Больше не нужно считать в уме, делить на калькуляторе или спорить — всё честно, быстро и точно.',
                feedback: 'Обратная связь',
                developer: 'Разработчик: Виноградов Павел',
                email: 'Почта: vinograd699@gmail.com',
                version: '© 2025 "Дели счёт". Все права защищены.'
            },
            en: {
                scan: 'Scan Receipt',
                calculate: 'Calculate Bill',
                about: 'About',
                scanPrompt: 'Upload receipt',
                scanButton: '📷 Scan QR Code',
                uploadPrompt: '📁 Drag image or click to select',
                participants: 'Participants',
                addParticipant: '+ Add Participant',
                items: 'Items',
                tips: 'Tips',
                calculateBtn: 'Calculate Bill',
                result: 'Result',
                aboutDesc1: '<strong>"Split the bill"</strong> is a convenient app to split bills among friends, family, or colleagues after a meal or shopping.',
                aboutDesc2: 'Just <strong>scan the receipt QR code</strong> — the app will automatically extract the list of items, prices, and quantities. Then specify who pays for what, and <strong>«"Split the bill"</strong> will calculate how much each person owes.',
                aboutDesc3: 'No more mental math, calculator fights, or arguments — everything is fair, fast, and accurate.',
                feedback: 'Feedback',
                developer: 'Developer: Vinogradov Pavel',
                email: 'Email: vinograd699@gmail.com',
                version: '© 2025 "Split the bill". All rights reserved.'
            }
        }[lang] || t.ru;

        function setText(id, text, method = 'textContent') {
            const el = document.getElementById(id);
            if (el) el[method] = text;
            else console.warn('⚠️ Элемент не найден:', id);
        }

        setText('tab-scan', t.scan);
        setText('tab-calculate', t.calculate);
        setText('tab-about', t.about);
        setText('label-scan-prompt', t.scanPrompt);
        setText('scan-qr', t.scanButton);
        setText('upload-prompt', t.uploadPrompt);
        setText('label-participants', t.participants);
        setText('add-participant-btn', t.addParticipant);
        setText('label-items', t.items);
        setText('label-tips', t.tips);
        setText('calculate-btn', t.calculateBtn);
        setText('label-about', t.about);
        setText('feedback-label', t.feedback);
        setText('about-desc-1', t.aboutDesc1, 'innerHTML');
        setText('about-desc-2', t.aboutDesc2, 'innerHTML');
        setText('about-desc-3', t.aboutDesc3);
        setText('developer-info', `${t.developer}<br><a href="mailto:vinograd699@gmail.com">${t.email}</a>`, 'innerHTML');
        setText('version-info', t.version);
    }

    // --- 5. РАСЧЁТ СЧЁТА ---
    document.getElementById('bill-form')?.addEventListener('submit', function (e) {
        e.preventDefault();
        console.log('🧮 Расчёт счёта');

        const participants = Array.from(document.querySelectorAll('#participants-container .participant-name'))
            .map(el => el.value.trim())
            .filter(name => name);

        if (participants.length === 0) {
            showNotification('❌ Нет участников', 'error');
            return;
        }

        const items = Array.from(document.querySelectorAll('#items-container .item')).map(el => {
            const name = el.querySelector('.item-name').value;
            const price = parseFloat(el.querySelector('.item-price').value) || 0;
            const quantity = parseFloat(el.querySelector('.item-quantity').value) || 0;
            const consumers = Array.from(el.querySelectorAll('.item-consumers input:checked'))
                .map(cb => cb.parentElement.textContent.trim());

            return { name, price, quantity, consumers };
        });

        const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        let tip = 0;
        const tipPercent = document.getElementById('tip-percent').checked;
        if (tipPercent) {
            const percent = parseFloat(document.getElementById('tip-amount').value) || 0;
            tip = (subtotal * percent) / 100;
        } else {
            tip = parseFloat(document.getElementById('tip-fixed-amount').value) || 0;
        }

        const totalWithTip = subtotal + tip;
        const tipPerPerson = tip / participants.length;

        const totals = {};
        participants.forEach(name => totals[name] = 0);

        items.forEach(item => {
            const itemTotal = item.price * item.quantity;
            const share = item.consumers.length > 0 ? itemTotal / item.consumers.length : 0;
            item.consumers.forEach(name => {
                if (totals.hasOwnProperty(name)) {
                    totals[name] += share;
                }
            });
        });

        participants.forEach(name => {
            totals[name] += tipPerPerson;
        });

        // Округление
        Object.keys(totals).forEach(name => {
            totals[name] = Math.round(totals[name] * 100) / 100;
        });

        showResult(totals, { subtotal, tip, total: totalWithTip });
    });

    // Показ результата
    function showResult(totals, breakdown) {
        const result = document.getElementById('result');
        const details = document.getElementById('result-details');
        result.style.display = 'block';
        details.innerHTML = '';

        const lang = localStorage.getItem('appLang') || 'ru';
        const t = lang === 'en'
            ? { subtotal: 'Subtotal:', tip: 'Tip:', total: 'Total:', toPay: 'To pay:' }
            : { subtotal: 'Сумма без чаевых:', tip: 'Чаевые:', total: 'Итого:', toPay: 'К оплате:' };

        const addLine = (label, value) => {
            const div = document.createElement('div');
            div.innerHTML = `<b>${label}</b> ${value.toFixed(2)} ₽`;
            details.appendChild(div);
        };

        addLine(t.subtotal, breakdown.subtotal);
        addLine(t.tip, breakdown.tip);
        const hr = document.createElement('hr');
        details.appendChild(hr);
        addLine(t.total, breakdown.total);

        Object.keys(totals).forEach(name => {
            const div = document.createElement('div');
            div.textContent = `${name}: ${totals[name]} ₽`;
            div.style.fontSize = '18px';
            details.appendChild(div);
        });

        const totalAll = Object.values(totals).reduce((a, b) => a + b, 0);
        const final = document.createElement('div');
        final.innerHTML = `<b>${t.toPay} ${totalAll.toFixed(2)} ₽</b>`;
        final.style.color = '#0071e3';
        final.style.marginTop = '10px';
        details.appendChild(final);

        showNotification(lang === 'en' ? '✅ Bill calculated!' : '✅ Счёт рассчитан!', 'success');
    }

    // --- 6. УВЕДОМЛЕНИЯ ---
    function showNotification(message, type) {
        const n = document.createElement('div');
        n.className = `notification ${type}`;
        n.textContent = message;
        n.style.cssText = `
            position: fixed; top: 30px; right: 30px; padding: 14px 20px;
            border-radius: 10px; background: ${type === 'success' ? '#28a745' : '#dc3545'};
            color: white; z-index: 10000; box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            font-size: 14px; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.2);
            opacity: 1; transition: opacity 0.3s;
        `;
        document.body.appendChild(n);
        setTimeout(() => {
            n.style.opacity = '0';
            setTimeout(() => n.remove(), 300);
        }, 5000);
    }

    // --- 7. УДАЛЕНИЕ ТОВАРА ---
    window.removeItem = function (button) {
        button.closest('.item').remove();
    };

    // --- 8. ЭКРАНИРОВАНИЕ HTML ---
    function escapeHtml(s) {
        return s.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // --- 9. ЗАПУСК ---
    setupTabs();
    setupLanguageSwitcher();
    setupQRScanner();
    addParticipant();
    translatePage();

    // --- 10. ЗАГРУЗКА jsQR ---
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
    script.async = true;
    script.onload = () => console.log('✅ jsQR успешно загружен');
    script.onerror = () => console.error('❌ Не удалось загрузить jsQR');
    document.head.appendChild(script);
});
