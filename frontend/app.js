class BillSplitterApp {
    constructor() {
        this.currentBillId = null;
        this.participants = [];
        this.items = [];
        this.currentStep = 1;
        this.currentReceiptType = 'restaurant';
        this.currentEnhanceMode = 'auto';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadBills();
    }

    setupEventListeners() {
        // Переключение табов
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Форма создания счета
        document.getElementById('bill-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createBill();
        });

        // Модальное окно
        document.querySelector('.close').addEventListener('click', () => {
            this.closeModal();
        });

        window.addEventListener('click', (e) => {
            if (e.target === document.getElementById('bill-modal')) {
                this.closeModal();
            }
        });

        // Обработчики для сканирования чеков
        this.setupScanningListeners();
    }

    setupScanningListeners() {
        // Обработчик выбора файла
        document.getElementById('receipt-file').addEventListener('change', (e) => {
            this.handleFileSelect(e);
        });

        // Drag and drop
        const uploadArea = document.getElementById('upload-area');
        uploadArea.addEventListener('click', () => {
            document.getElementById('receipt-file').click();
        });

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileSelect({ target: { files: files } });
            }
        });
    }

    // Метод updateConsumerCheckboxes
    updateConsumerCheckboxes() {
        const participants = Array.from(document.querySelectorAll('.participant'));
        
        document.querySelectorAll('.item-consumers').forEach(container => {
            container.innerHTML = participants.map((participant, index) => {
                const name = participant.querySelector('.participant-name').value || `Участник ${index + 1}`;
                return `<label class="consumer-checkbox">
                    <input type="checkbox" value="${index}" checked> ${name}
                </label>`;
            }).join('');
        });
    }

    switchTab(tabName) {
        // Обновляем активные кнопки табов
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.toggle('active', button.dataset.tab === tabName);
        });

        // Обновляем активный контент
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });

        // Загружаем данные при переключении на соответствующие табы
        if (tabName === 'bills') {
            this.loadBills();
        }
    }

    async createBill() {
        console.log('Creating bill...');
        
        const billData = {
            title: document.getElementById('bill-title').value,
            description: document.getElementById('bill-description').value,
            tip: parseFloat(document.getElementById('bill-tip').value) || 0, // УБРАНО TAX
            currency: document.getElementById('bill-currency').value,
            created_by: "User",
            participants: this.collectParticipants(),
            items: this.collectItems()
        };

        console.log('Bill data:', billData);

        try {
            const response = await fetch('/api/bills', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(billData)
            });

            if (response.ok) {
                const bill = await response.json();
                console.log('Bill created:', bill);
                this.showNotification('Счет успешно создан!', 'success');
                this.resetForm();
                this.switchTab('bills');
            } else {
                const errorText = await response.text();
                console.error('Server error:', errorText);
                throw new Error(`Ошибка сервера: ${response.status} ${errorText}`);
            }
        } catch (error) {
            console.error('Error creating bill:', error);
            this.showNotification('Ошибка при создании счета: ' + error.message, 'error');
        }
    }

    collectParticipants() {
        const participants = [];
        document.querySelectorAll('.participant').forEach((participantEl, index) => {
            const name = participantEl.querySelector('.participant-name').value;
            const email = participantEl.querySelector('.participant-email').value;
            if (name) {
                participants.push({
                    id: `participant${index + 1}`,
                    name: name,
                    email: email || ''
                });
            }
        });
        console.log('Collected participants:', participants);
        return participants;
    }

    collectItems() {
        const items = [];
        document.querySelectorAll('.item').forEach((itemEl, index) => {
            const name = itemEl.querySelector('.item-name').value;
            const price = parseFloat(itemEl.querySelector('.item-price').value);
            const consumedBy = Array.from(itemEl.querySelectorAll('input[type="checkbox"]:checked'))
                .map(cb => {
                    const participantIndex = parseInt(cb.value);
                    return `participant${participantIndex + 1}`;
                });

            if (name && !isNaN(price) && consumedBy.length > 0) {
                items.push({
                    id: `item${index + 1}`,
                    name: name,
                    price: price,
                    consumed_by: consumedBy
                });
            }
        });
        console.log('Collected items:', items);
        return items;
    }

    async loadBills() {
        const billsList = document.getElementById('bills-list');
        billsList.innerHTML = '<div class="loading"><div class="spinner"></div><p>Загрузка счетов...</p></div>';

        try {
            const response = await fetch('/api/bills');
            if (response.ok) {
                const bills = await response.json();
                console.log('Loaded bills:', bills);
                this.displayBills(bills);
            } else {
                throw new Error('Ошибка при загрузке счетов: ' + response.status);
            }
        } catch (error) {
            console.error('Error loading bills:', error);
            billsList.innerHTML = '<p class="placeholder">Ошибка при загрузке счетов: ' + error.message + '</p>';
        }
    }

    displayBills(bills) {
        const billsList = document.getElementById('bills-list');
        
        if (!bills || bills.length === 0) {
            billsList.innerHTML = '<p class="placeholder">Счетов пока нет. Создайте первый счет!</p>';
            return;
        }

        billsList.innerHTML = bills.map(bill => {
            const total = bill.items.reduce((sum, item) => sum + item.price, 0);
            const date = new Date(bill.created_at).toLocaleDateString('ru-RU');
            
            return `
                <div class="bill-card">
                    <h3>${bill.title}</h3>
                    <div class="bill-meta">
                        <strong>${bill.currency} ${total.toFixed(2)}</strong><br>
                        ${bill.participants.length} участников<br>
                        ${date}
                    </div>
                    <p>${bill.description || 'Без описания'}</p>
                    <div class="bill-actions">
                        <button class="bill-action view-split" onclick="app.viewSplit('${bill.id}')">
                            Результаты
                        </button>
                        <button class="bill-action view-details" onclick="app.viewBillDetails('${bill.id}')">
                            Детали
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    calculateTotal(bill) {
        return bill.items.reduce((sum, item) => sum + item.price, 0);
    }

    async viewSplit(billId) {
        console.log('Viewing split for bill:', billId);
        this.switchTab('split');
        
        const splitResults = document.getElementById('split-results');
        splitResults.innerHTML = '<div class="loading"><div class="spinner"></div><p>Расчет разделения...</p></div>';

        try {
            const response = await fetch(`/api/bills/${billId}/split`);
            if (response.ok) {
                const split = await response.json();
                console.log('Split results:', split);
                this.displaySplitResults(split);
            } else {
                throw new Error('Ошибка при расчете разделения: ' + response.status);
            }
        } catch (error) {
            console.error('Error calculating split:', error);
            splitResults.innerHTML = '<p class="placeholder">Ошибка при загрузке результатов: ' + error.message + '</p>';
        }
    }

    displaySplitResults(split) {
        const splitResults = document.getElementById('split-results');
        
        if (!split || !split.split) {
            splitResults.innerHTML = '<p class="placeholder">Нет данных для отображения</p>';
            return;
        }

        const currency = split.currency || 'RUB';
        const currencySymbol = this.getCurrencySymbol(currency);

        const summaryHtml = `
            <div class="split-summary">
                <h3>Результаты разделения</h3>
                <div class="summary-grid">
                    <div class="summary-item">
                        <div>Общая сумма</div>
                        <div class="summary-value">${currencySymbol} ${split.total_amount.toFixed(2)}</div>
                    </div>
                    <div class="summary-item">
                        <div>Чаевые</div>
                        <div class="summary-value">${currencySymbol} ${split.tip_amount.toFixed(2)}</div>
                    </div>
                    <div class="summary-item">
                        <div>Итого</div>
                        <div class="summary-value">${currencySymbol} ${split.grand_total.toFixed(2)}</div>
                    </div>
                </div>
            </div>
        `;

        const participantsHtml = `
            <div class="participant-split split-header">
                <div>Участник</div>
                <div>Позиции</div>
                <div>Чаевые</div>
                <div>Итого</div>
            </div>
            ${split.split.map(participant => `
                <div class="participant-split">
                    <div><strong>${participant.participant_name}</strong></div>
                    <div>${currencySymbol} ${participant.subtotal.toFixed(2)}</div>
                    <div>${currencySymbol} ${participant.tip_share.toFixed(2)}</div>
                    <div class="participant-total">${currencySymbol} ${participant.total.toFixed(2)}</div>
                </div>
            `).join('')}
        `;

        splitResults.innerHTML = summaryHtml + participantsHtml;
    }

    getCurrencySymbol(currency) {
        const symbols = {
            'RUB': '₽',
            'USD': '$',
            'EUR': '€',
            'GBP': '£'
        };
        return symbols[currency] || currency;
    }

    async viewBillDetails(billId) {
        try {
            const response = await fetch(`/api/bills/${billId}`);
            if (response.ok) {
                const bill = await response.json();
                this.showBillModal(bill);
            } else {
                throw new Error('Ошибка при загрузке счета');
            }
        } catch (error) {
            console.error('Error loading bill details:', error);
            this.showNotification('Ошибка при загрузке деталей счета', 'error');
        }
    }

    showBillModal(bill) {
        const modalBody = document.getElementById('modal-body');
        
        const total = bill.items.reduce((sum, item) => sum + item.price, 0);
        const currencySymbol = this.getCurrencySymbol(bill.currency);
        
        modalBody.innerHTML = `
            <h2>${bill.title}</h2>
            <p><strong>Описание:</strong> ${bill.description || 'Нет описания'}</p>
            <p><strong>Создан:</strong> ${new Date(bill.created_at).toLocaleString('ru-RU')}</p>
            <p><strong>Общая сумма:</strong> ${currencySymbol} ${total.toFixed(2)}</p>
            ${bill.tip > 0 ? `<p><strong>Чаевые:</strong> ${bill.tip}%</p>` : ''}
            
            <h3>Участники (${bill.participants.length})</h3>
            <ul>
                ${bill.participants.map(p => `<li>${p.name}${p.email ? ` (${p.email})` : ''}</li>`).join('')}
            </ul>
            
            <h3>Позиции счета (${bill.items.length})</h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                <thead>
                    <tr style="background: #f8f9fa;">
                        <th style="padding: 10px; text-align: left;">Позиция</th>
                        <th style="padding: 10px; text-align: right;">Цена</th>
                        <th style="padding: 10px; text-align: left;">Участники</th>
                    </tr>
                </thead>
                <tbody>
                    ${bill.items.map(item => {
                        const consumers = item.consumed_by.map(id => {
                            const participant = bill.participants.find(p => p.id === id);
                            return participant ? participant.name : id;
                        }).join(', ');
                        
                        return `
                            <tr>
                                <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
                                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
                                    ${currencySymbol} ${item.price.toFixed(2)}
                                </td>
                                <td style="padding: 10px; border-bottom: 1px solid #eee;">
                                    ${consumers}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;

        document.getElementById('bill-modal').style.display = 'block';
    }

    closeModal() {
        document.getElementById('bill-modal').style.display = 'none';
    }

    resetForm() {
        document.getElementById('bill-form').reset();
        document.getElementById('participants-container').innerHTML = `
            <div class="participant">
                <input type="text" class="participant-name" placeholder="Имя участника" required>
                <input type="email" class="participant-email" placeholder="Email (опционально)">
                <button type="button" class="remove-participant" onclick="removeParticipant(this)">×</button>
            </div>
        `;
        document.getElementById('items-container').innerHTML = `
            <div class="item">
                <input type="text" class="item-name" placeholder="Название позиции" required>
                <input type="number" class="item-price" placeholder="Цена" min="0" step="0.01" required>
                <div class="item-consumers">
                    <label class="consumer-checkbox">
                        <input type="checkbox" value="0" checked> Участник 1
                    </label>
                </div>
                <button type="button" class="remove-item" onclick="removeItem(this)">×</button>
            </div>
        `;
        this.updateConsumerCheckboxes();
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            z-index: 1001;
            background: ${type === 'success' ? '#28a745' : 
                        type === 'error' ? '#dc3545' : 
                        type === 'info' ? '#17a2b8' : '#6c757d'};
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    // Методы для сканирования чеков
    openScanModal() {
        this.currentStep = 1;
        this.updateScanSteps();
        document.getElementById('scan-receipt-modal').style.display = 'block';
        this.resetScanModal();
    }

    closeScanModal() {
        document.getElementById('scan-receipt-modal').style.display = 'none';
    }

    resetScanModal() {
        document.getElementById('receipt-file').value = '';
        document.getElementById('recognized-text').value = '';
        document.getElementById('parsed-items-list').innerHTML = '';
        document.getElementById('items-count').textContent = '0';
        document.getElementById('total-amount').textContent = '0';
        
        const uploadArea = document.getElementById('upload-area');
        uploadArea.innerHTML = `
            <div class="upload-placeholder">
                <span class="upload-icon">📁</span>
                <p>Перетащите сюда фото чека или нажмите для выбора</p>
                <p class="upload-hint">Поддерживаются: JPG, PNG</p>
            </div>
        `;
    }

    updateScanSteps() {
        document.querySelectorAll('.step').forEach(step => {
            step.classList.remove('active');
        });
        document.querySelector(`.step[data-step="${this.currentStep}"]`).classList.add('active');

        document.querySelectorAll('.scan-step').forEach(step => {
            step.classList.remove('active');
        });
        document.getElementById(`scan-step-${this.currentStep}`).classList.add('active');
    }

    nextStep() {
        this.currentStep++;
        this.updateScanSteps();
    }

    previousStep() {
        this.currentStep--;
        this.updateScanSteps();
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.match('image.*')) {
            this.showNotification('Пожалуйста, выберите изображение (JPG, PNG)', 'error');
            return;
        }

        // Показываем превью
        const reader = new FileReader();
        reader.onload = (e) => {
            const uploadArea = document.getElementById('upload-area');
            uploadArea.innerHTML = `
                <div class="image-preview">
                    <img src="${e.target.result}" alt="Превью чека" style="max-height: 200px;">
                </div>
            `;
            document.getElementById('receipt-preview').src = e.target.result;
        };
        reader.readAsDataURL(file);

        this.nextStep();
        await this.recognizeTextFromImage(file);
    }

    async recognizeTextFromImage(file) {
        const progressText = document.getElementById('progress-text');
        const progressOverlay = document.getElementById('progress-overlay');
        const parseBtn = document.getElementById('parse-btn');
        
        progressOverlay.style.display = 'flex';
        parseBtn.disabled = true;
        progressText.textContent = 'Подготовка к распознаванию...';

        try {
            const worker = await Tesseract.createWorker('rus+eng', 1, {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        progressText.textContent = `Распознавание: ${Math.round(m.progress * 100)}%`;
                    }
                }
            });

            const { data: { text } } = await worker.recognize(file);
            document.getElementById('recognized-text').value = text;
            
            await worker.terminate();
            
            progressOverlay.style.display = 'none';
            parseBtn.disabled = false;
            
            this.showNotification('Текст успешно распознан!', 'success');
            
        } catch (error) {
            console.error('OCR Error:', error);
            progressText.textContent = 'Ошибка при распознавании текста';
            this.showNotification('Ошибка при распознавании текста', 'error');
        }
    }

    manualEditText() {
        const textarea = document.getElementById('recognized-text');
        textarea.readOnly = false;
        textarea.focus();
        this.showNotification('Редактируйте текст, затем нажмите "Анализировать позиции"', 'info');
    }

    retryRecognition() {
        document.getElementById('receipt-file').click();
    }

    parseReceiptText() {
        const text = document.getElementById('recognized-text').value;
        if (!text.trim()) {
            this.showNotification('Сначала распознайте текст или введите его вручную', 'error');
            return;
        }

        const items = this.parseReceiptItems(text);
        this.displayParsedItems(items);
        this.nextStep();
    }

    parseReceiptItems(text) {
        const lines = text.split('\n').filter(line => line.trim());
        const items = [];
        let totalAmount = 0;

        const pricePatterns = [
            /(\d+[.,]\d{2})[^0-9]*$/,
            /(\d+)[^0-9]*$/,
            /[x×*]\s*(\d+[.,]\d{2})/,
            /[x×*]\s*(\d+)/
        ];

        lines.forEach((line, index) => {
            if (this.isSummaryLine(line)) return;

            let price = null;
            let itemName = line.trim();

            for (const pattern of pricePatterns) {
                const match = line.match(pattern);
                if (match) {
                    price = parseFloat(match[1].replace(',', '.'));
                    itemName = line.substring(0, match.index).trim();
                    break;
                }
            }

            if (!price && index < lines.length - 1) {
                const nextLine = lines[index + 1];
                for (const pattern of pricePatterns) {
                    const match = nextLine.match(pattern);
                    if (match) {
                        price = parseFloat(match[1].replace(',', '.'));
                        break;
                    }
                }
            }

            if (price && itemName && this.isValidItem(itemName)) {
                items.push({
                    name: this.cleanItemName(itemName),
                    price: price,
                    originalLine: line
                });
                totalAmount += price;
            }
        });

        return { items, totalAmount };
    }

    isSummaryLine(line) {
        const summaryKeywords = [
            'итого', 'всего', 'total', 'сумма', 'оплата', 'налог',
            'ндс', 'cash', 'card', 'сдача', 'change', 'чек',
            'чек №', 'date', 'дата', 'время', 'time'
        ];
        
        const lowerLine = line.toLowerCase();
        return summaryKeywords.some(keyword => lowerLine.includes(keyword));
    }

    isValidItem(itemName) {
        const invalidPatterns = [
            /^[0-9.,\s]+$/,
            /^(шт|kg|кг|pcs|уп|упак)/i
        ];
        
        return !invalidPatterns.some(pattern => pattern.test(itemName)) && 
               itemName.length > 1;
    }

    cleanItemName(name) {
        return name
            .replace(/[0-9]+[.,]?[0-9]*[x×*]\s*/g, '')
            .replace(/[^a-zA-Zа-яА-Я0-9\s\-]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    displayParsedItems({ items, totalAmount }) {
        const container = document.getElementById('parsed-items-list');
        
        if (items.length === 0) {
            container.innerHTML = `
                <div class="parsed-item error">
                    <div>Не удалось распознать позиции</div>
                    <div>Проверьте текст и попробуйте снова</div>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="parsed-item parsed-item-header">
                <div>Название</div>
                <div>Цена</div>
                <div>Действия</div>
            </div>
        `;

        items.forEach((item, index) => {
            const itemEl = document.createElement('div');
            itemEl.className = 'parsed-item';
            itemEl.innerHTML = `
                <div class="parsed-item-name">
                    <input type="text" value="${item.name}" data-index="${index}">
                </div>
                <div class="parsed-item-price">
                    <input type="number" value="${item.price.toFixed(2)}" step="0.01" min="0" data-index="${index}">
                </div>
                <div class="parsed-item-actions">
                    <button type="button" class="btn-remove" onclick="app.removeParsedItem(${index})">
                        ×
                    </button>
                </div>
            `;
            container.appendChild(itemEl);
        });

        document.getElementById('items-count').textContent = items.length;
        document.getElementById('total-amount').textContent = totalAmount.toFixed(2);
    }

    removeParsedItem(index) {
        const items = this.getCurrentParsedItems();
        items.splice(index, 1);
        this.displayParsedItems({
            items: items,
            totalAmount: items.reduce((sum, item) => sum + item.price, 0)
        });
    }

    getCurrentParsedItems() {
        const items = [];
        document.querySelectorAll('.parsed-item:not(.parsed-item-header)').forEach(itemEl => {
            const nameInput = itemEl.querySelector('.parsed-item-name input');
            const priceInput = itemEl.querySelector('.parsed-item-price input');
            
            if (nameInput && priceInput) {
                items.push({
                    name: nameInput.value,
                    price: parseFloat(priceInput.value) || 0
                });
            }
        });
        return items;
    }

    addParsedItemsToBill() {
        const items = this.getCurrentParsedItems();
        
        if (items.length === 0) {
            this.showNotification('Нет позиций для добавления', 'error');
            return;
        }

        items.forEach(item => {
            this.addItemFromScanning(item.name, item.price);
        });

        this.closeScanModal();
        this.showNotification(`Добавлено ${items.length} позиций из чека`, 'success');
    }

    addItemFromScanning(name, price) {
        const container = document.getElementById('items-container');
        const consumersHtml = Array.from(document.querySelectorAll('.participant'))
            .map((participant, index) => {
                const participantName = participant.querySelector('.participant-name').value || `Участник ${index + 1}`;
                return `<label class="consumer-checkbox">
                    <input type="checkbox" value="${index}" checked> ${participantName}
                </label>`;
            }).join('');

        const itemEl = document.createElement('div');
        itemEl.className = 'item';
        itemEl.innerHTML = `
            <input type="text" class="item-name" value="${name}" required>
            <input type="number" class="item-price" value="${price.toFixed(2)}" min="0" step="0.01" required>
            <div class="item-consumers">${consumersHtml}</div>
            <button type="button" class="remove-item" onclick="removeItem(this)">×</button>
        `;

        container.appendChild(itemEl);
    }

    openManualReceiptModal() {
        document.getElementById('manual-receipt-modal').style.display = 'block';
    }

    closeManualReceiptModal() {
        document.getElementById('manual-receipt-modal').style.display = 'none';
    }

    processManualReceipt() {
        const text = document.getElementById('manual-receipt-text').value;
        if (!text.trim()) {
            this.showNotification('Введите текст чека', 'error');
            return;
        }

        const items = this.parseReceiptItems(text);
        items.items.forEach(item => {
            this.addItemFromScanning(item.name, item.price);
        });

        this.closeManualReceiptModal();
        this.showNotification(`Добавлено ${items.items.length} позиций из чека`, 'success');
    }
}

// Глобальные функции для работы с формами
function addParticipant() {
    const container = document.getElementById('participants-container');
    const index = container.children.length;
    
    const participantEl = document.createElement('div');
    participantEl.className = 'participant';
    participantEl.innerHTML = `
        <input type="text" class="participant-name" placeholder="Имя участника" required>
        <input type="email" class="participant-email" placeholder="Email (опционально)">
        <button type="button" class="remove-participant" onclick="removeParticipant(this)">×</button>
    `;
    
    container.appendChild(participantEl);
    app.updateConsumerCheckboxes();
}

function removeParticipant(button) {
    if (document.querySelectorAll('.participant').length > 1) {
        button.parentElement.remove();
        app.updateConsumerCheckboxes();
    }
}

function addItem() {
    const container = document.getElementById('items-container');
    const consumersHtml = Array.from(document.querySelectorAll('.participant'))
        .map((participant, index) => {
            const name = participant.querySelector('.participant-name').value || `Участник ${index + 1}`;
            return `<label class="consumer-checkbox">
                <input type="checkbox" value="${index}" checked> ${name}
            </label>`;
        }).join('');
    
    const itemEl = document.createElement('div');
    itemEl.className = 'item';
    itemEl.innerHTML = `
        <input type="text" class="item-name" placeholder="Название позиции" required>
        <input type="number" class="item-price" placeholder="Цена" min="0" step="0.01" required>
        <div class="item-consumers">${consumersHtml}</div>
        <button type="button" class="remove-item" onclick="removeItem(this)">×</button>
    `;
    
    container.appendChild(itemEl);
}

function removeItem(button) {
    if (document.querySelectorAll('.item').length > 1) {
        button.parentElement.remove();
    }
}

// Инициализация приложения
const app = new BillSplitterApp();

// Инициализация начального состояния
document.addEventListener('DOMContentLoaded', function() {
    addParticipant();
    addItem();
    
    // Обработчики для выбора типа чека
    document.querySelectorAll('.receipt-type-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.receipt-type-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            app.currentReceiptType = this.dataset.type;
        });
    });
    
    // Обработчики для выбора улучшения изображения
    document.querySelectorAll('.enhance-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.enhance-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            app.currentEnhanceMode = this.dataset.enhance;
        });
    });
    
    // Инициализация значений по умолчанию
    app.currentReceiptType = 'restaurant';
    app.currentEnhanceMode = 'auto';
});