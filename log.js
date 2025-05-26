// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyB8hmrUOAhNts5dscg847Nrfwlus6gwIhU",
    authDomain: "arduino-ffe65.firebaseapp.com",
    databaseURL: "https://arduino-ffe65-default-rtdb.firebaseio.com",
    projectId: "arduino-ffe65",
    storageBucket: "arduino-ffe65.appspot.com",
    messagingSenderId: "740100253151",
    appId: "1:740100253151:web:6984faba0a86339520506a",
    measurementId: "G-JG3C4ET2HY"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Variables globales
let voltageChart, currentChart, powerChart, combinedChart;
let dataHistory = [];
const maxDataPoints = 60;
let lastUpdateTime = 0;
let isPaused = false;
let lastValues = { voltage: 0, current: 0, power: 0 };
let maxValues = { voltage: 0, current: 0 };
let startTime = Date.now();
let sampleCount = 0;
let uptimeInterval;

const chartColors = {
    voltage: '#4361ee',
    current: '#3a0ca3',
    power: '#f72585',
    bgVoltage: 'rgba(67, 97, 238, 0.1)',
    bgCurrent: 'rgba(58, 12, 163, 0.1)',
    bgPower: 'rgba(247, 37, 133, 0.1)',
    gridColor: 'rgba(255, 255, 255, 0.05)',
    textColor: '#94a3b8'
};

function initCharts() {
    Chart.defaults.color = chartColors.textColor;
    Chart.defaults.borderColor = chartColors.gridColor;

    voltageChart = new Chart(document.getElementById('voltage-chart'), {
        type: 'line',
        data: { datasets: [{ label: 'Voltaje (V)', borderColor: chartColors.voltage, backgroundColor: chartColors.bgVoltage, borderWidth: 3, pointRadius: 0, tension: 0.4, fill: true, data: [] }] },
        options: getChartOptions('Voltaje (V)')
    });

    currentChart = new Chart(document.getElementById('current-chart'), {
        type: 'line',
        data: { datasets: [{ label: 'Corriente (A)', borderColor: chartColors.current, backgroundColor: chartColors.bgCurrent, borderWidth: 3, pointRadius: 0, tension: 0.4, fill: true, data: [] }] },
        options: getChartOptions('Corriente (A)')
    });

    powerChart = new Chart(document.getElementById('power-chart'), {
        type: 'line',
        data: { datasets: [{ label: 'Potencia (W)', borderColor: chartColors.power, backgroundColor: chartColors.bgPower, borderWidth: 3, pointRadius: 0, tension: 0.4, fill: true, data: [] }] },
        options: getChartOptions('Potencia (W)')
    });

    combinedChart = new Chart(document.getElementById('combined-chart'), {
        type: 'line',
        data: {
            datasets: [
                { label: 'Voltaje (V)', borderColor: chartColors.voltage, data: [], backgroundColor: 'transparent', borderWidth: 3, pointRadius: 0, tension: 0.4, yAxisID: 'y' },
                { label: 'Corriente (A)', borderColor: chartColors.current, data: [], backgroundColor: 'transparent', borderWidth: 3, pointRadius: 0, tension: 0.4, yAxisID: 'y1' },
                { label: 'Potencia (W)', borderColor: chartColors.power, data: [], backgroundColor: 'transparent', borderWidth: 3, pointRadius: 0, tension: 0.4, yAxisID: 'y2' }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { color: chartColors.textColor, font: { size: 13, family: 'Montserrat' }, padding: 20 } },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(30, 41, 59, 0.9)',
                    titleColor: '#ffffff',
                    bodyColor: '#e2e8f0',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12
                }
            },
            scales: {
                x: { type: 'time', time: { unit: 'second', displayFormats: { second: 'HH:mm:ss' }, tooltipFormat: 'HH:mm:ss' }, grid: { color: chartColors.gridColor }, ticks: { color: chartColors.textColor } },
                y: { position: 'left', title: { display: true, text: 'Voltaje (V)', color: chartColors.voltage }, ticks: { color: chartColors.textColor }, grid: { color: chartColors.gridColor } },
                y1: { position: 'right', title: { display: true, text: 'Corriente (A)', color: chartColors.current }, ticks: { color: chartColors.textColor }, grid: { drawOnChartArea: false } },
                y2: { position: 'right', title: { display: true, text: 'Potencia (W)', color: chartColors.power }, ticks: { color: chartColors.textColor }, grid: { drawOnChartArea: false } }
            }
        }
    });
}

function getChartOptions(title) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: 'rgba(30, 41, 59, 0.9)',
                titleColor: '#ffffff',
                bodyColor: '#e2e8f0'
            }
        },
        scales: {
            x: { type: 'time', time: { unit: 'second', displayFormats: { second: 'HH:mm:ss' }, tooltipFormat: 'HH:mm:ss' }, grid: { color: chartColors.gridColor }, ticks: { color: chartColors.textColor }, display: false },
            y: {
                grid: { color: chartColors.gridColor },
                ticks: { color: chartColors.textColor },
                title: { display: true, text: title, color: chartColors.textColor }
            }
        }
    };
}

function processNewData(snapshot) {
    if (isPaused) return;

    const data = snapshot.val();
    if (!data || !data.voltage || !data.current || !data.power) return;

    // Mostrar en pantalla
    document.getElementById('voltage-value').textContent = data.voltage.toFixed(2);
    document.getElementById('current-value').textContent = data.current.toFixed(2);
    document.getElementById('power-value').textContent = data.power.toFixed(2);

    // Actualizar tendencias
    updateTrends(data);
    
    // Actualizar gráficos y datos
    updateCharts(data);
    updateHistoryTable(data);
    updateMaxValues(data);
    updateStats();

    // Guardar datos en historial
    dataHistory.push({
        timestamp: new Date(),
        voltage: data.voltage,
        current: data.current,
        power: data.power
    });

    // Limitar tamaño del historial
    if (dataHistory.length > 100) {
        dataHistory.shift();
    }

    lastValues = data;
    sampleCount++;
    lastUpdateTime = 0;
    document.getElementById('last-update').textContent = lastUpdateTime;
}

function updateTrends(data) {
    // Calcular tendencias
    const voltageTrend = ((data.voltage - lastValues.voltage) / (lastValues.voltage || 1)) * 100;
    const currentTrend = ((data.current - lastValues.current) / (lastValues.current || 1)) * 100;
    const powerTrend = ((data.power - lastValues.power) / (lastValues.power || 1)) * 100;

    // Actualizar elementos de tendencia
    updateTrendElement('voltage-trend', voltageTrend);
    updateTrendElement('current-trend', currentTrend);
    updateTrendElement('power-trend', powerTrend);

    // Mostrar alertas si es necesario
    checkAlerts(data);
}

function updateTrendElement(elementId, trendValue) {
    const trendElement = document.getElementById(elementId);
    const icon = trendElement.querySelector('i');
    const valueSpan = trendElement.querySelector('span');
    
    // Actualizar icono y color según la tendencia
    if (trendValue > 0) {
        icon.className = 'fas fa-arrow-up';
        trendElement.style.color = '#4ade80'; // Verde
    } else if (trendValue < 0) {
        icon.className = 'fas fa-arrow-down';
        trendElement.style.color = '#f87171'; // Rojo
    } else {
        icon.className = 'fas fa-equals';
        trendElement.style.color = '#94a3b8'; // Gris
    }
    
    valueSpan.textContent = `${Math.abs(trendValue).toFixed(1)}%`;
}

function checkAlerts(data) {
    const alertBanner = document.getElementById('alert-banner');
    const alertMessage = document.getElementById('alert-message');
    let showAlert = false;
    let message = '';
    
    // Verificar condiciones de alerta
    if (data.voltage > 250) {
        showAlert = true;
        message = '¡Alerta! Voltaje peligrosamente alto';
    } else if (data.voltage < 100) {
        showAlert = true;
        message = '¡Alerta! Voltaje peligrosamente bajo';
    } else if (data.current > 4.5) {
        showAlert = true;
        message = '¡Alerta! Sobrecarga detectada';
    } else if (data.current < 0.1 && data.voltage > 10) {
        showAlert = true;
        message = '¡Alerta! Posible circuito abierto';
    }
    
    // Mostrar u ocultar banner de alerta
    if (showAlert) {
        alertMessage.textContent = message;
        alertBanner.style.display = 'flex';
        alertBanner.style.backgroundColor = '#dc2626'; // Rojo para alertas
    } else {
        alertBanner.style.display = 'none';
    }
}

function updateCharts(data) {
    const now = new Date();

    // Actualizar gráfico de voltaje
    voltageChart.data.labels.push(now);
    voltageChart.data.datasets[0].data.push(data.voltage);
    if (voltageChart.data.labels.length > maxDataPoints) {
        voltageChart.data.labels.shift();
        voltageChart.data.datasets[0].data.shift();
    }
    voltageChart.update('none');

    // Actualizar gráfico de corriente
    currentChart.data.labels.push(now);
    currentChart.data.datasets[0].data.push(data.current);
    if (currentChart.data.labels.length > maxDataPoints) {
        currentChart.data.labels.shift();
        currentChart.data.datasets[0].data.shift();
    }
    currentChart.update('none');

    // Actualizar gráfico de potencia
    powerChart.data.labels.push(now);
    powerChart.data.datasets[0].data.push(data.power);
    if (powerChart.data.labels.length > maxDataPoints) {
        powerChart.data.labels.shift();
        powerChart.data.datasets[0].data.shift();
    }
    powerChart.update('none');

    // Actualizar gráfico combinado
    combinedChart.data.labels.push(now);
    combinedChart.data.datasets[0].data.push(data.voltage);
    combinedChart.data.datasets[1].data.push(data.current);
    combinedChart.data.datasets[2].data.push(data.power);
    if (combinedChart.data.labels.length > maxDataPoints) {
        combinedChart.data.labels.shift();
        combinedChart.data.datasets.forEach(ds => ds.data.shift());
    }
    combinedChart.update('none');
}

function updateHistoryTable(data) {
    const tableBody = document.getElementById('data-table');
    const now = new Date();
    const timeString = now.toLocaleTimeString();

    // Limitar a 10 filas
    if (tableBody.rows.length >= 10) {
        tableBody.deleteRow(-1);
    }

    // Determinar estado del sistema
    const voltage = data.voltage;
    const current = data.current;
    let status = "Normal";
    let statusClass = "badge";

    if (voltage > 250) {
        status = "Alto Voltaje";
        statusClass += " danger";
    } else if (voltage < 100) {
        status = "Bajo Voltaje";
        statusClass += " warning";
    } else if (current > 4.5) {
        status = "Sobrecarga";
        statusClass += " danger";
    } else if (current < 0.1 && voltage > 10) {
        status = "Circuito Abierto";
        statusClass += " warning";
    } else {
        statusClass += " success";
    }

    // Calcular tendencia de potencia
    const powerTrend = ((data.power - lastValues.power) / (lastValues.power || 1)) * 100;
    const trendIcon = powerTrend > 0 ? 'fa-arrow-up' : (powerTrend < 0 ? 'fa-arrow-down' : 'fa-equals');

    // Insertar nueva fila al principio
    const row = tableBody.insertRow(0);
    row.innerHTML = `
        <td>${timeString}</td>
        <td>${data.voltage.toFixed(2)}</td>
        <td>${data.current.toFixed(2)}</td>
        <td>${data.power.toFixed(2)}</td>
        <td><span class="${statusClass}">${status}</span></td>
        <td><i class="fas ${trendIcon}"></i> ${Math.abs(powerTrend).toFixed(1)}%</td>
    `;
}

function updateMaxValues(data) {
    if (data.voltage > maxValues.voltage) {
        maxValues.voltage = data.voltage;
        document.getElementById('max-voltage').textContent = `${data.voltage.toFixed(2)} V`;
    }
    if (data.current > maxValues.current) {
        maxValues.current = data.current;
        document.getElementById('max-current').textContent = `${data.current.toFixed(2)} A`;
    }
}

function updateStats() {
    document.getElementById('samples-value').textContent = sampleCount;
}

function formatUptime(ms) {
    const s = Math.floor((ms / 1000) % 60);
    const m = Math.floor((ms / (1000 * 60)) % 60);
    const h = Math.floor((ms / (1000 * 60 * 60)) % 24);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function updateUptime() {
    const uptime = Date.now() - startTime;
    document.getElementById('uptime-value').textContent = formatUptime(uptime);
}

function updateLastUpdateCounter() {
    if (!isPaused) {
        lastUpdateTime++;
        document.getElementById('last-update').textContent = lastUpdateTime;
    }
}

function showNotification(message, isSuccess = true) {
    const notification = document.getElementById('notification');
    const notificationIcon = notification.querySelector('i');
    const notificationMessage = document.getElementById('notification-message');
    
    notificationMessage.textContent = message;
    notificationIcon.className = isSuccess ? 'fas fa-check-circle' : 'fas fa-exclamation-circle';
    notification.style.backgroundColor = isSuccess ? '#10b981' : '#ef4444';
    notification.style.display = 'flex';
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            notification.style.display = 'none';
            notification.style.opacity = '1';
        }, 500);
    }, 3000);
}

function togglePause() {
    isPaused = !isPaused;
    const pauseBtn = document.getElementById('pause-btn');
    
    if (isPaused) {
        pauseBtn.innerHTML = '<i class="fas fa-play"></i> Reanudar Actualización';
        pauseBtn.classList.remove('secondary');
        pauseBtn.classList.add('success');
        showNotification('Actualización pausada', false);
    } else {
        pauseBtn.innerHTML = '<i class="fas fa-pause"></i> Pausar Actualización';
        pauseBtn.classList.remove('success');
        pauseBtn.classList.add('secondary');
        showNotification('Actualización reanudada');
    }
}

function clearData() {
    // Limpiar gráficos
    [voltageChart, currentChart, powerChart, combinedChart].forEach(chart => {
        chart.data.labels = [];
        chart.data.datasets.forEach(dataset => {
            dataset.data = [];
        });
        chart.update();
    });
    
    // Limpiar tabla de historial
    document.getElementById('data-table').innerHTML = '';
    
    // Reiniciar contadores
    dataHistory = [];
    maxValues = { voltage: 0, current: 0 };
    sampleCount = 0;
    updateStats();
    
    showNotification('Datos limpiados correctamente');
}

function exportToCSV() {
    if (dataHistory.length === 0) {
        showNotification('No hay datos para exportar', false);
        return;
    }
    
    let csv = 'Fecha,Hora,Voltaje (V),Corriente (A),Potencia (W)\n';
    
    dataHistory.forEach(item => {
        const date = item.timestamp.toLocaleDateString();
        const time = item.timestamp.toLocaleTimeString();
        csv += `${date},${time},${item.voltage.toFixed(2)},${item.current.toFixed(2)},${item.power.toFixed(2)}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `datos_generador_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('Datos exportados a CSV');
}

function setupEventListeners() {
    document.getElementById('pause-btn').addEventListener('click', togglePause);
    document.getElementById('clear-btn').addEventListener('click', clearData);
    document.getElementById('export-btn').addEventListener('click', exportToCSV);
    document.getElementById('refresh-btn').addEventListener('click', () => {
        database.ref('sensorData').limitToLast(1).once('value')
            .then(snapshot => {
                snapshot.forEach(child => processNewData(child));
                showNotification('Datos actualizados manualmente');
            })
            .catch(error => {
                console.error('Error al actualizar:', error);
                showNotification('Error al actualizar datos', false);
            });
    });
}

// Inicializar la aplicación
function initApp() {
    initCharts();
    setupEventListeners();
    
    // Iniciar contadores
    uptimeInterval = setInterval(updateUptime, 1000);
    setInterval(updateLastUpdateCounter, 1000);

    // Configurar listener de Firebase
    database.ref('sensorData').limitToLast(1).on('child_added', snapshot => {
        processNewData(snapshot);
    });
    
    // Mostrar mensaje de bienvenida
    setTimeout(() => {
        showNotification('Sistema de monitoreo iniciado correctamente');
    }, 1500);
}

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initApp);