// frontend/app.js — "Дели счёт" (Версия 5.2)
// Только ручное переключение темы, кнопка слева
// Автор: GigaCode

document.addEventListener('DOMContentLoaded', function () {
    console.log('✅ DOM загружен — инициализация приложения');

    // --- 1. ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ---
    function setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabContents.forEach(tab => {
            tab.style.display = tab.classList.contains('active') ? 'block' : 'none';
        });

        tabButtons.forEach(button => {
            button.addEventListener('click', function () {
                const tabName = this.dataset.tab;
                console.log('📌 Переключение на вкладку:', tabName);

                tabButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');

                tabContents.forEach(tab => {
                    tab.style.display = 'none';
                });

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

    // --- 3. ЗАГРУЗКА ФАЙЛА — КЛИК + DRAG & DROP ---
    function setupFileUpload() {
        const uploadArea = document.getElementById('upload-area');
        const receiptPreview = document.getElementById('receipt-preview');

        if (!uploadArea) {
            console.error('❌ #upload-area не найден');
            return;
        }

        if (!receipt-preview) {
            console.error('❌ #receipt-preview не найден');
            return;
        }

        // Клик: открыть проводник
        uploadArea.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const url = URL.createObjectURL(file);
                    receiptPreview.innerHTML = `
                        <img src="${url}" alt="Чек" style="max-width:100%;border-radius:12px;margin-top:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1)">
                    `;
                }
            };
            input.click();
        });

        // Drag & Drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.background = 'var(--upload-bg)';
            uploadArea.style.borderColor = 'var(--accent-color)';
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');

            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                const url = URL.createObjectURL(file);
                receiptPreview.innerHTML = `
                    <img src="${url}" alt="Чек" style="max-width:100%;border-radius:12px;margin-top:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1)">
                `;
            }
        });
    }

    // --- 4. СКАНИРОВАНИЕ QR-КОДА ---
    function setupQRScanner() {
        const scanButton = document.getElementById('scan-qr');
        if (!scanButton) {
            console.warn('🟡 Кнопка #scan-qr не найдена — сканирование отключено');
            return;
        }

        scanButton.addEventListener('click', async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                console.log('✅ Доступ к камере получен');

                const video = document.createElement('video');
                video.srcObject = stream;
                video.autoplay = true;
                video.playsInline = true;
                video.style = 'width:100%;max-width:400px;border-radius:12px;margin:10px auto;display:block';

                const container = document.getElementById('upload-area');
                container.innerHTML = '<p style="color:var(--accent-color);margin:10px 0">🔍 Наведите камеру на QR-код</p>';
                container.appendChild(video);

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d', { willReadFrequently: true });

                const scanLoop = setInterval(() => {
                    if (video.videoWidth === 0) return;
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                    if (typeof jsQR === 'undefined') return;

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
                let errorMsg = '❌ Ошибка';
                if (err.name === 'NotAllowedError') errorMsg = '❌ Доступ к камере запрещён';
                if (err.name === 'NotFoundError') errorMsg = '❌ Камера не найдена';
                if (err.name === 'NotReadableError') errorMsg = '❌ Камера занята';
                if (err.name === 'NotSupportedError') errorMsg = '❌ Требуется HTTPS';

                document.getElementById('upload-area').innerHTML = `<p style="color:red">${errorMsg}</p>`;
                alert(errorMsg);
            }
        });
    }

    // Остановка потока
    function stopStream(stream) {
        stream.getTracks().forEach(track => track.stop());
    }

    // Разбор QR-URL
    function parseQRUrl(qrData) {
        console.log('📝 Обработка QR:', qrData);
        try {
            const raw = qrData.includes('?') ? qrData.split('?')[1] : qrData;
            const params = new URLSearchParams(raw);
            const fn = params.get('fn');
            const fd = params.get('i') || params.get('fd');
            const fp = params.get('fp');
            const t = params.get('t');
            const s = params.get('s');

            if (!fn || !fd || !fp || !t || !s) {
                alert('❌ QR-код не содержит данных');
                return;
            }

            const formattedT = t.length > 13 ? t.substring(0, 13) : t;
            fetchCheckFromAPI(fn, fd, fp, formattedT, s);
        } catch (err) {
            console.error('❌ Ошибка парсинга QR:', err);
            alert('❌ Не удалось распознать QR-код');
        }
    }

    // Запрос чека
    async function fetchCheckFromAPI(fn, fd, fp, t, s) {
        const container = document.getElementById('upload-area');
        container.innerHTML = '<div class="loading">📥 Получение чека...</div>';

        try {
            const response = await fetch('https://delischet.ru/api/check', {
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
                container.innerHTML = '<p>❌ Ошибка</p>';
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
            container.innerHTML = '<p style="color:var(--accent-color)">✅ Чек успешно загружен</p>';

        } catch (err) {
            console.error('❌ Ошибка загрузки чека:', err);
            showNotification('❌ ' + err.message, 'error');
            container.innerHTML = `<p style="color:red">❌ ${err.message}</p>`;
        }
    }

    // Заполнить товары
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
                <input type="number" class="item-quantity" value="${item.quantity}" min="1" step="1" style="width:60px">
                <span class="item-total"><b>= ${total} ₽</b></span>
                <div class="item-consumers"></div>
                <button type="button" class="remove-item" onclick="removeItem(this)">×</button>
            `;
            container.appendChild(el);
        });
        updateConsumerCheckboxes();
    }

    // --- 5. ПЕРЕКЛЮЧЕНИЕ ЯЗЫКА — ТОЛЬКО ФЛАГИ ---
    function setupLanguageSwitcher() {
        const toggle = document.getElementById('lang-toggle');
        const menu = document.getElementById('lang-menu');

        if (!toggle || !menu) {
            console.error('❌ Элементы переключателя языка не найдены');
            return;
        }

        function updateToggleIcon(lang) {
            toggle.innerHTML = lang === 'ru' ? '🇷🇺' : '🇬🇧';
        }

        const savedLang = localStorage.getItem('appLang') || 'ru';
        updateToggleIcon(savedLang);

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
                    updateToggleIcon(lang);
                    menu.style.display = 'none';
                }
            }
        });
    }

    // --- 6. ПЕРЕВОД ТЕКСТА ---
    function translatePage(lang = localStorage.getItem('appLang') || 'ru') {
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
                aboutDesc1: '<strong>"Дели счёт"</strong> — это удобное приложение для разделения счёта...',
                aboutDesc2: 'Просто <strong>отсканируйте QR-код чека</strong> — приложение автоматически...',
                aboutDesc3: 'Больше не нужно считать в уме...',
                feedback: 'Обратная связь',
                developer: 'Разработчик: Виноградов Павел',
                email: 'Почта: vinograd699@gmail.com',
                version: '© 2025 "Дели счёт". Все права защищены.',
                donateTitle: 'Поддержите проект 💙',
                donateDesc: 'Помогите развивать «Дели счёт» — любой вклад важен!',
                donateLabel: '₽',
                donateBtn: '💸 Поддержать через ЮMoney',
                donateFooter: 'Без комиссии • Через СБП • Защищено ЮMoney'
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
                aboutDesc1: '<strong>"Split the bill"</strong> is a convenient app...',
                developer: 'Developer: Vinogradov Pavel',
                email: 'Email: vinograd699@gmail.com',
                version: '© 2025 "Split the bill". All rights reserved.'
            }
        }[lang] || t.ru;

        function setText(id, text, method = 'textContent') {
            const el = document.getElementById(id);
            if (el) el[method] = text;
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
        setText('developer-info', `${t.developer}<br><a href="mailto:vinograd699@gmail.com">${t.email}</a>`, 'innerHTML');
        setText('version-info', t.version);
    }

    // --- 7. РАСЧЁТ СЧЁТА ---
    document.getElementById('bill-form')?.addEventListener('submit', function (e) {
        e.preventDefault();
        const participants = Array.from(document.querySelectorAll('#participants-container .participant-name'))
            .map(el => el.value.trim()).filter(name => name);

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
        Object.keys(totals).forEach(name => {
            totals[name] = Math.round(totals[name] * 100) / 100;
        });

        showResult(totals, { subtotal, tip, total: totalWithTip });
    });

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
        final.style.color = 'var(--accent-color)';
        final.style.marginTop = '10px';
        details.appendChild(final);
        showNotification(lang === 'en' ? '✅ Bill calculated!' : '✅ Счёт рассчитан!', 'success');
    }

    // --- 8. УВЕДОМЛЕНИЯ ---
    function showNotification(message, type) {
        const n = document.createElement('div');
        n.className = `notification ${type}`;
        n.textContent = message;
        n.style.cssText = `
            position: fixed; top: 30px; right: 30px; padding: 14px 20px; border-radius: 10px;
            background: var(--notification-bg); color: white;
            z-index: 10000; box-shadow: 0 4px 20px rgba(0,0,0,0.15); font-size: 14px;
            backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.2);
            opacity: 1; transition: opacity 0.3s;
        `;
        document.body.appendChild(n);
        setTimeout(() => {
            n.style.opacity = '0';
            setTimeout(() => n.remove(), 300);
        }, 5000);
    }

    // --- 9. УДАЛЕНИЕ ТОВАРА ---
    window.removeItem = function (button) {
        button.closest('.item').remove();
    };

    // --- 10. ЭКРАНИРОВАНИЕ HTML ---
    function escapeHtml(s) {
        return s.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // --- 11. ДОНАТЫ ---
    const donateAmount = document.getElementById('donate-amount');
    const donateButton = document.getElementById('donate-button');
    if (donateAmount && donateButton) {
        function updateDonateLink() {
            const amount = parseFloat(donateAmount.value) || 100;
            donateButton.href = `https://yoomoney.ru/to/4100119432123264/${amount}`;
        }
        donateAmount.addEventListener('input', updateDonateLink);
        updateDonateLink();
    }

    // --- 12. ТЕМНАЯ ТЕМА — ТОЛЬКО РУЧНОЕ ПЕРЕКЛЮЧЕНИЕ (БЕЗ AUTO) ---
    function setupThemeToggle() {
        const toggle = document.getElementById('theme-toggle');

        // Только из localStorage, без prefers-color-scheme
        const savedTheme = localStorage.getItem('appTheme') || 'light';

        if (savedTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            toggle.textContent = '🌙';
        } else {
            document.documentElement.removeAttribute('data-theme');
            toggle.textContent = '🌞';
        }

        toggle.addEventListener('click', () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const newTheme = isDark ? 'light' : 'dark';

            if (newTheme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
                toggle.textContent = '🌙';
                localStorage.setItem('appTheme', 'dark');
            } else {
                document.documentElement.removeAttribute('data-theme');
                toggle.textContent = '🌞';
                localStorage.setItem('appTheme', 'light');
            }
        });
    }

    // --- 13. ЗАПУСК ВСЕХ МОДУЛЕЙ ---
    setupTabs();
    setupLanguageSwitcher();
    setupFileUpload();
    setupQRScanner();
    setupThemeToggle();  // Кнопка слева, только ручной режим
    addParticipant();
    translatePage();

    // --- 14. ЗАГРУЗКА jsQR ---
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
    script.async = true;
    script.onload = () => console.log('✅ jsQR успешно загружен');
    script.onerror = () => console.error('❌ Не удалось загрузить jsQR');
    document.head.appendChild(script);
});
