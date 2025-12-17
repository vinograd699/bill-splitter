// === Глобальные переменные ===
let participants = [];
let items = [];
let currentLang = localStorage.getItem('lang') || 'ru';

// === Переводы ===
const translations = {
    ru: {
        scan: 'Сканировать',
        calculate: 'Рассчитать',
        about: 'О проекте',
        scan_qr: '📷 Сканировать QR-код чека',
        upload_prompt: 'Выберите файл или перетащите его сюда',
        participants: 'Участники',
        add_participant: '+ Добавить участника',
        items: 'Товары',
        add_item: '+ Добавить товар',
        tips: 'Чаевые',
        calculate_btn: 'Рассчитать',
        result: 'К оплате:',
        support: '💙 Поддержать проект',
        or: 'или'
    },
    en: {
        scan: 'Scan',
        calculate: 'Calculate',
        about: 'About',
        scan_qr: '📷 Scan receipt QR code',
        upload_prompt: 'Choose a file or drag it here',
        participants: 'Participants',
        add_participant: '+ Add participant',
        items: 'Items',
        add_item: '+ Add item',
        tips: 'Tips',
        calculate_btn: 'Calculate',
        result: 'To pay:',
        support: '💙 Support project',
        or: 'or'
    }
};

// === Обновление языка ===
function updateLanguage() {
    const lang = localStorage.getItem('lang') || 'ru';
    currentLang = lang;

    // Обновляем тексты
    document.querySelectorAll('[data-lang-text]').forEach(el => {
        const key = el.getAttribute('data-lang-text');
        if (translations[lang] && translations[lang][key]) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = translations[lang][key];
            } else {
                el.textContent = translations[lang][key];
            }
        }
    });

    // Обновляем текст на кнопке переключения языка
    document.getElementById('lang-text').textContent = lang === 'ru' ? 'Рус' : 'Eng';

    // Обновляем вкладки
    document.querySelector('[data-tab="scan"]').textContent = translations[lang].scan;
    document.querySelector('[data-tab="calculate"]').textContent = translations[lang].calculate;
    document.querySelector('[data-tab="about"]').textContent = translations[lang].about;
}

// === Инициализация при загрузке ===
document.addEventListener('DOMContentLoaded', () => {
    // Устанавливаем язык
    const savedLang = localStorage.getItem('lang') || 'ru';
    document.getElementById('lang-text').textContent = savedLang === 'ru' ? 'Рус' : 'Eng';
    updateLanguage();

    // === Переключение языка ===
    const langToggle = document.getElementById('lang-toggle');
    const langMenu = document.getElementById('lang-menu');

    langToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        langMenu.style.display = langMenu.style.display === 'block' ? 'none' : 'block';
    });

    document.addEventListener('click', () => {
        langMenu.style.display = 'none';
    });

    langMenu.addEventListener('click', (e) => e.stopPropagation());

    document.querySelectorAll('#lang-menu button').forEach(btn => {
        btn.addEventListener('click', () => {
            const newLang = btn.getAttribute('data-lang');
            localStorage.setItem('lang', newLang);
            updateLanguage();
            langMenu.style.display = 'none';
        });
    });

    // === Вкладки ===
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.getAttribute('data-tab')).classList.add('active');
        });
    });

    // === Участники ===
    const participantsContainer = document.getElementById('participants-container');
    const addParticipantBtn = document.getElementById('add-participant-btn');

    function addParticipant(name = '') {
        const div = document.createElement('div');
        div.className = 'participant';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Имя участника';
        input.value = name;
        input.setAttribute('data-lang-text', 'participant_placeholder');

        const removeBtn = document.createElement('button');
        removeBtn.textContent = '×';
        removeBtn.className = 'remove-participant';
        removeBtn.type = 'button';

        removeBtn.addEventListener('click', () => {
            participantsContainer.removeChild(div);
            updateItemsConsumers();
        });

        div.appendChild(input);
        div.appendChild(removeBtn);
        participantsContainer.appendChild(div);

        updateItemsConsumers();
    }

    addParticipantBtn.addEventListener('click', () => {
        addParticipant();
    });

    // === Товары ===
    const itemsContainer = document.getElementById('items-container');
    const addItemBtn = document.getElementById('add-item-btn');

    function addItem(name = '', price = '', quantity = '') {
        const div = document.createElement('div');
        div.className = 'item';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'item-name';
        nameInput.placeholder = 'Название товара';
        nameInput.value = name;

        const priceInput = document.createElement('input');
        priceInput.type = 'number';
        priceInput.className = 'item-price';
        priceInput.placeholder = 'Цена';
        priceInput.value = price;
        priceInput.min = '0';
        priceInput.step = '0.01';

        const quantityInput = document.createElement('input');
        quantityInput.type = 'number';
        quantityInput.className = 'item-quantity';
        quantityInput.placeholder = 'Кол-во';
        quantityInput.value = quantity || '1';
        quantityInput.min = '1';

        const totalDisplay = document.createElement('div');
        totalDisplay.className = 'item-total';
        totalDisplay.textContent = '0 ₽';

        const consumersDiv = document.createElement('div');
        consumersDiv.className = 'item-consumers';

        function updateTotal() {
            const price = parseFloat(priceInput.value) || 0;
            const qty = parseInt(quantityInput.value) || 1;
            totalDisplay.textContent = (price * qty).toFixed(2) + ' ₽';
        }

        priceInput.addEventListener('input', updateTotal);
        quantityInput.addEventListener('input', updateTotal);

        const removeBtn = document.createElement('button');
        removeBtn.textContent = '×';
        removeBtn.className = 'remove-item';
        removeBtn.type = 'button';
        removeBtn.addEventListener('click', () => {
            itemsContainer.removeChild(div);
        });

        div.appendChild(nameInput);
        div.appendChild(priceInput);
        div.appendChild(quantityInput);
        div.appendChild(totalDisplay);
        div.appendChild(consumersDiv);
        div.appendChild(removeBtn);

        itemsContainer.appendChild(div);
        updateTotal();
        updateItemsConsumers();
    }

    addItemBtn.addEventListener('click', () => {
        addItem();
    });

    function updateItemsConsumers() {
        document.querySelectorAll('.item').forEach(itemDiv => {
            const consumersDiv = itemDiv.querySelector('.item-consumers');
            consumersDiv.innerHTML = '';
            consumersDiv.insertAdjacentHTML('beforeend', `<strong>Кто ел:</strong><br>`);

            participantsContainer.querySelectorAll('input').forEach(input => {
                if (input.value.trim() === '') return;

                const label = document.createElement('label');
                label.innerHTML = `
                    <input type="checkbox" checked> ${input.value}
                `;
                consumersDiv.appendChild(label);
            });
        });
    }

    // === Расчёт ===
    document.getElementById('calculate-btn').addEventListener('click', () => {
        const tipPercent = parseFloat(document.getElementById('tip-amount').value) || 0;
        const tipFixed = parseFloat(document.getElementById('tip-fixed-amount').value) || 0;

        let totalBill = 0;
        const participantSums = {};

        participantsContainer.querySelectorAll('.participant input').forEach(input => {
            const name = input.value.trim();
            if (name) participantSums[name] = 0;
        });

        itemsContainer.querySelectorAll('.item').forEach(item => {
            const price = parseFloat(item.querySelector('.item-price').value) || 0;
            const qty = parseInt(item.querySelector('.item-quantity').value) || 1;
            const itemTotal = price * qty;
            totalBill += itemTotal;

            const checkboxes = item.querySelectorAll('.item-consumers input[type="checkbox"]:checked');
            const names = Array.from(checkboxes).map(cb => cb.nextSibling.textContent.trim());
            const count = names.length || 1;

            names.forEach(name => {
                if (participantSums[name] !== undefined) {
                    participantSums[name] += itemTotal / count;
                }
            });
        });

        const tip = tipFixed > 0 ? tipFixed : (totalBill * tipPercent) / 100;
        const totalWithTip = totalBill + tip;

        // Распределяем чаевые пропорционально
        let sumWithoutTip = Object.values(participantSums).reduce((a, b) => a + b, 0);
        if (sumWithoutTip > 0) {
            Object.keys(participantSums).forEach(name => {
                const share = participantSums[name] / sumWithoutTip;
                participantSums[name] += tip * share;
            });
        }

        const resultDiv = document.getElementById('result');
        const detailsDiv = document.getElementById('result-details');
        detailsDiv.innerHTML = '';

        Object.keys(participantSums).forEach(name => {
            if (name) {
                const p = document.createElement('p');
                p.textContent = `${name}: ${participantSums[name].toFixed(2)} ₽`;
                detailsDiv.appendChild(p);
            }
        });

        const totalP = document.createElement('p');
        totalP.innerHTML = `<strong>Итого: ${totalWithTip.toFixed(2)} ₽</strong>`;
        detailsDiv.appendChild(totalP);

        resultDiv.style.display = 'block';
    });

    // === Сканирование QR-кода (заглушка) ===
    document.getElementById('scan-qr').addEventListener('click', () => {
        alert('Сканирование QR-кода временно недоступно. Используйте ручной ввод.');
    });

    // Загрузка файла
    const uploadArea = document.getElementById('upload-area');
    const receiptPreview = document.getElementById('receipt-preview');

    uploadArea.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = e => {
            const file = e.target.files[0];
            if (file) {
                const url = URL.createObjectURL(file);
                receiptPreview.innerHTML = `<img src="${url}" alt="Чек">`;
            }
        };
        input.click();
    });

    // Перетаскивание
    uploadArea.addEventListener('dragover', e => {
        e.preventDefault();
        uploadArea.style.background = '#eef4ff';
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.background = '#f8f8ff';
    });

    uploadArea.addEventListener('drop', e => {
        e.preventDefault();
        uploadArea.style.background = '#f8f8ff';
        const file = e.dataTransfer.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            receiptPreview.innerHTML = `<img src="${url}" alt="Чек">`;
        }
    });

    // Инициализация: добавляем одного участника по умолчанию
    addParticipant();
    addItem();
});
