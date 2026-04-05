// Month/year selector logic
const monthSelect = document.getElementById('monthSelect');
const yearSelect = document.getElementById('yearSelect');
function populateMonthYearSelectors(history) {
    // Store current selection
    const prevYear = yearSelect.value;
    const prevMonth = monthSelect.value;

    // Get all unique years from history
    const years = Array.from(new Set(history.map(e => new Date(e.date).getFullYear()))).sort((a, b) => a - b);
    // Populate yearSelect
    yearSelect.innerHTML = '';
    years.forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
    });

    // Populate monthSelect based on selected year
    const selectedYear = prevYear && years.includes(Number(prevYear)) ? Number(prevYear) : years[years.length-1];
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthsInYear = Array.from(new Set(history.filter(e => new Date(e.date).getFullYear() === selectedYear).map(e => new Date(e.date).getMonth()))).sort((a, b) => a - b);
    monthSelect.innerHTML = '';
    monthsInYear.forEach(i => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = months[i];
        monthSelect.appendChild(opt);
    });

    // Restore previous selection if possible, else default to latest
    yearSelect.value = prevYear && years.includes(Number(prevYear)) ? prevYear : years[years.length-1];
    monthSelect.value = prevMonth && monthsInYear.includes(Number(prevMonth)) ? prevMonth : (monthsInYear[monthsInYear.length-1] || 0);
}

// Load shift history from localStorage
function loadShiftHistory() {
    const history = JSON.parse(localStorage.getItem('shiftHistory') || '[]');
    populateMonthYearSelectors(history);
    // Get selected month/year
    const selectedMonth = parseInt(monthSelect.value, 10);
    const selectedYear = parseInt(yearSelect.value, 10);
    // Sort by date descending
    history.sort((a, b) => new Date(b.date) - new Date(a.date));
    // Set today once for use in both history and future shifts
    const today = new Date();
    today.setHours(0,0,0,0);
    const historyList = document.getElementById('shiftHistory');
    historyList.innerHTML = '';
    // Only include past and today's shifts for all calculations
    const filteredHistory = history.filter(entry => {
        const entryDate = new Date(entry.date);
        entryDate.setHours(0,0,0,0);
        return entryDate <= today && entryDate.getMonth() === selectedMonth && entryDate.getFullYear() === selectedYear;
    });
    filteredHistory.forEach((entry, idx) => {
        let text = `${entry.date} - ${entry.shift} - Workstation ${entry.workstation}`;
        if (entry.extraHours && entry.extraHours !== "") {
            text += ` - Extra Hours: ${entry.extraHours}`;
        }
        if (entry.coveredFor && entry.coveredFor !== "") {
            text += ` - Covered For: ${entry.coveredFor}`;
        }
        if (entry.salary && entry.salary !== "") {
            text += ` - Salary: Rs ${parseFloat(entry.salary).toFixed(2)}`;
        }
        const li = document.createElement('li');
        li.textContent = text;
        // Actions
        const actions = document.createElement('span');
        actions.className = 'shift-actions';
        // Move to Future button
        const moveToFutureBtn = document.createElement('button');
        moveToFutureBtn.textContent = 'Move to Future';
        moveToFutureBtn.className = 'shift-btn';
        moveToFutureBtn.onclick = function() {
            // Use a hidden date input for user-friendly date picking
            const dateInput = document.getElementById('moveToFutureDate');
            dateInput.value = '';
            dateInput.min = new Date(Date.now() + 24*60*60*1000).toISOString().slice(0,10); // tomorrow or later
            dateInput.style.display = 'block';
            dateInput.focus();
            dateInput.onchange = function() {
                const newDate = dateInput.value;
                if (newDate) {
                    const picked = new Date(newDate);
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    picked.setHours(0,0,0,0);
                    if (picked > today) {
                        const allHistory = JSON.parse(localStorage.getItem('shiftHistory') || '[]');
                        const idxInAll = allHistory.findIndex(e =>
                            e.date === entry.date &&
                            e.shift === entry.shift &&
                            e.workstation === entry.workstation &&
                            (e.extraStartTime || '') === (entry.extraStartTime || '') &&
                            (e.extraStopTime || '') === (entry.extraStopTime || '') &&
                            (e.extraHours || '') === (entry.extraHours || '') &&
                            (e.coveredFor || '') === (entry.coveredFor || '')
                        );
                        if (idxInAll !== -1) {
                            allHistory[idxInAll].date = newDate;
                            localStorage.setItem('shiftHistory', JSON.stringify(allHistory));
                            loadShiftHistory();
                        }
                        dateInput.style.display = 'none';
                    } else {
                        alert('Please pick a future date.');
                    }
                }
                dateInput.style.display = 'none';
                dateInput.onchange = null;
            };
        };
        actions.appendChild(moveToFutureBtn);
        // Edit button
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.className = 'shift-btn';
        editBtn.onclick = function() {
            document.getElementById('date').value = entry.date;
            setShiftValue(entry.shift);
            setWorkstationValue(entry.workstation);
            document.getElementById('extraStartTime').value = entry.extraStartTime || '';
            document.getElementById('extraStopTime').value = entry.extraStopTime || '';
            document.getElementById('extraHours').value = entry.extraHours || '';
            document.getElementById('coveredFor').value = entry.coveredFor || '';
            shiftForm.setAttribute('data-edit-idx', idx);
            shiftForm.setAttribute('data-edit-original', JSON.stringify(entry));
        };
        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'shift-btn';
        deleteBtn.onclick = function() {
            if (confirm('Delete this shift?')) {
                filteredHistory.splice(idx, 1);
                localStorage.setItem('shiftHistory', JSON.stringify(filteredHistory));
                loadShiftHistory();
                shiftForm.removeAttribute('data-edit-idx');
                shiftForm.removeAttribute('data-edit-original');
                shiftForm.reset();
            }
        };
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
        li.appendChild(actions);
        historyList.appendChild(li);
    });
    const validShifts = ['Morning', 'Evening', 'Night', 'NightLong'];
    // Display covered shift count (only count entries with valid shift type and no extra hours)
    const coveredEntries = filteredHistory.filter(entry => validShifts.includes(entry.shift) && (!entry.extraHours || parseFloat(entry.extraHours) === 0));
    const coveredShiftsCount = coveredEntries.length;
    const coveredShiftHoursSum = coveredEntries.reduce((sum, entry) => sum + getShiftPaidHours(entry.workstation, entry.shift, entry.date), 0);
    const shiftCountDiv = document.getElementById('shiftCount');
    shiftCountDiv.textContent = `Total Covered Shifts: ${coveredShiftsCount}`;
    const coveredShiftHoursDiv = document.getElementById('coveredShiftHours');
    if (coveredShiftHoursDiv) {
        coveredShiftHoursDiv.textContent = `Total Covered Shift Hours: ${coveredShiftHoursSum} hrs`;
    }

    // Display total working days (unique dates with at least one covered shift)
    const workingDays = new Set(coveredEntries.map(entry => entry.date));
    let workingDaysDiv = document.getElementById('workingDays');
    if (!workingDaysDiv) {
        workingDaysDiv = document.createElement('div');
        workingDaysDiv.id = 'workingDays';
        (coveredShiftHoursDiv || shiftCountDiv).insertAdjacentElement('afterend', workingDaysDiv);
    }
    workingDaysDiv.style.marginBottom = '10px';
    workingDaysDiv.style.fontWeight = 'bold';
    workingDaysDiv.textContent = `Total Working Days: ${workingDays.size}`;

    // Calculate total extra hours (all shifts)
    let totalExtraHours = 0;
    filteredHistory.forEach(entry => {
        if (entry.extraHours && !isNaN(parseFloat(entry.extraHours))) {
            totalExtraHours += parseFloat(entry.extraHours);
        }
    });

    // Display total extra hours
    let totalExtraHoursDiv = document.getElementById('totalExtraHours');
    if (!totalExtraHoursDiv) {
        totalExtraHoursDiv = document.createElement('div');
        totalExtraHoursDiv.id = 'totalExtraHours';
        workingDaysDiv.insertAdjacentElement('afterend', totalExtraHoursDiv);
    }
    totalExtraHoursDiv.style.marginBottom = '10px';
    totalExtraHoursDiv.style.fontWeight = 'bold';
    totalExtraHoursDiv.textContent = `Total Extra Hours: ${totalExtraHours}`;

    // Display future shifts
    const futureShifts = history
        .map((entry, idx) => ({...entry, idx}))
        .filter(entry => {
            const entryDate = new Date(entry.date);
            entryDate.setHours(0,0,0,0);
            return entryDate > today;
        });
    futureShifts.sort((a, b) => new Date(a.date) - new Date(b.date));
    const futureList = document.getElementById('futureShifts');
    futureList.innerHTML = '';
    futureShifts.forEach(entry => {
        const li = document.createElement('li');
        let text = `${entry.date} - ${entry.shift} - Workstation ${entry.workstation}`;
        if (entry.salary && entry.salary !== "") {
            text += ` - Salary: $${parseFloat(entry.salary).toFixed(2)}`;
        }
        li.textContent = text;
        // Actions
        const actions = document.createElement('span');
        actions.className = 'shift-actions';
        // Done button
        const doneBtn = document.createElement('button');
        doneBtn.textContent = 'Done';
        doneBtn.className = 'shift-btn';
        doneBtn.onclick = function() {
            // Set this shift's date to today and reload
            const allHistory = JSON.parse(localStorage.getItem('shiftHistory') || '[]');
            const idx = allHistory.findIndex(e =>
                e.date === entry.date &&
                e.shift === entry.shift &&
                e.workstation === entry.workstation &&
                (e.extraStartTime || '') === (entry.extraStartTime || '') &&
                (e.extraStopTime || '') === (entry.extraStopTime || '') &&
                (e.extraHours || '') === (entry.extraHours || '') &&
                (e.coveredFor || '') === (entry.coveredFor || '')
            );
            if (idx !== -1) {
                const todayStr = new Date().toISOString().slice(0, 10);
                allHistory[idx].date = todayStr;
                localStorage.setItem('shiftHistory', JSON.stringify(allHistory));
                loadShiftHistory();
            }
        };
        actions.appendChild(doneBtn);
        // Edit button
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.className = 'shift-btn';
        editBtn.onclick = function() {
            document.getElementById('date').value = entry.date;
            setShiftValue(entry.shift);
            setWorkstationValue(entry.workstation);
            document.getElementById('extraStartTime').value = entry.extraStartTime || '';
            document.getElementById('extraStopTime').value = entry.extraStopTime || '';
            document.getElementById('extraHours').value = entry.extraHours || '';
            document.getElementById('coveredFor').value = entry.coveredFor || '';
            shiftForm.setAttribute('data-edit-idx', entry.idx);
        };
        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'shift-btn';
        deleteBtn.onclick = function() {
            if (confirm('Delete this shift?')) {
                const allHistory = JSON.parse(localStorage.getItem('shiftHistory') || '[]');
                allHistory.splice(entry.idx, 1);
                localStorage.setItem('shiftHistory', JSON.stringify(allHistory));
                loadShiftHistory();
                shiftForm.removeAttribute('data-edit-idx');
                shiftForm.reset();
            }
        };
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
        li.appendChild(actions);
        futureList.appendChild(li);
    });

    // Listen for month/year changes
    monthSelect.addEventListener('change', loadShiftHistory);
    yearSelect.addEventListener('change', loadShiftHistory);
}

// Handle form submission
const shiftForm = document.getElementById('shiftForm');
shiftForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const date = document.getElementById('date').value;
    const shift = getShiftValue();
    const workstation = getWorkstationValue();
    const extraHours = document.getElementById('extraHours').value;
    const coveredFor = document.getElementById('coveredFor').value;
    if (!date || !shift || !workstation) return;
    let history = JSON.parse(localStorage.getItem('shiftHistory') || '[]');
    const editIdx = shiftForm.getAttribute('data-edit-idx');
    if (editIdx !== null) {
        // Find the original entry in the full history array by matching all fields
        const original = JSON.parse(shiftForm.getAttribute('data-edit-original'));
        const idxInHistory = history.findIndex(e =>
            e.date === original.date &&
            e.shift === original.shift &&
            e.workstation === original.workstation &&
            (e.extraStartTime || '') === (original.extraStartTime || '') &&
            (e.extraStopTime || '') === (original.extraStopTime || '') &&
            (e.extraHours || '') === (original.extraHours || '') &&
            (e.coveredFor || '') === (original.coveredFor || '')
        );
        if (idxInHistory !== -1) {
            const extraStartTimeVal = document.getElementById('extraStartTime').value;
            const extraStopTimeVal = document.getElementById('extraStopTime').value;
            const prev = history[idxInHistory];
            history[idxInHistory] = { date, shift, workstation, extraStartTime: extraStartTimeVal, extraStopTime: extraStopTimeVal, extraHours, coveredFor, salary: prev.salary };
        }
        shiftForm.removeAttribute('data-edit-idx');
        shiftForm.removeAttribute('data-edit-original');
    } else {
        // Add new
        const extraStartTimeVal = document.getElementById('extraStartTime').value;
        const extraStopTimeVal = document.getElementById('extraStopTime').value;
        history.unshift({ date, shift, workstation, extraStartTime: extraStartTimeVal, extraStopTime: extraStopTimeVal, extraHours, coveredFor });
    }
    localStorage.setItem('shiftHistory', JSON.stringify(history));
    populateMonthYearSelectors(history);
    loadShiftHistory();
    shiftForm.reset();
});

// On page load, populate selectors and then load history
populateMonthYearSelectors(JSON.parse(localStorage.getItem('shiftHistory') || '[]'));
loadShiftHistory();

// Add XLSX export functionality
function exportToXLSX() {
    const history = JSON.parse(localStorage.getItem('shiftHistory') || '[]');
    if (history.length === 0) {
        alert('No shift data to export!');
        return;
    }
    // Only export shifts for the selected month and year
    const selectedMonthIdx = parseInt(document.getElementById('monthSelect').value, 10);
    const selectedYearVal = parseInt(document.getElementById('yearSelect').value, 10);
    const filteredExport = history.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate.getMonth() === selectedMonthIdx && entryDate.getFullYear() === selectedYearVal;
    });
    // Prepare data for Excel (sort by date ascending, then shift time)
    const shiftOrder = { 'Morning': 1, 'Evening': 2, 'Night': 3, 'NightLong': 4 };
    const sortedHistory = [...filteredExport].sort((a, b) => {
        const dateDiff = new Date(a.date) - new Date(b.date);
        if (dateDiff !== 0) return dateDiff;
        return (shiftOrder[a.shift] || 99) - (shiftOrder[b.shift] || 99);
    });
    const data = sortedHistory.map(entry => ({
        Date: entry.date,
        Shift: entry.shift,
        Workstation: entry.workstation,
        'Extra Start Time': entry.extraStartTime ? entry.extraStartTime : '',
        'Extra Stop Time': entry.extraStopTime ? entry.extraStopTime : '',
        'Extra Hours': entry.extraHours ? entry.extraHours : '',
        'Covered For': entry.coveredFor ? entry.coveredFor : '',
        Salary: entry.salary ? entry.salary : '',
    }));

    // Calculate summary
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const validShifts = ['Morning', 'Evening', 'Night', 'NightLong'];

    // Filter for current month
    const monthlyShifts = history.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate.getMonth() === currentMonth && entryDate.getFullYear() === currentYear;
    });

    // Group by date
    const shiftsByDay = {};
    monthlyShifts.forEach(entry => {
        if (!shiftsByDay[entry.date]) shiftsByDay[entry.date] = [];
        shiftsByDay[entry.date].push(entry);
    });

    // Calculate salary
    let monthlySalary = 0;
    Object.values(shiftsByDay).forEach(shifts => {
        const fullShiftsRaw = shifts.filter(entry => validShifts.includes(entry.shift) && (!entry.extraHours || parseFloat(entry.extraHours) === 0));
        const fullShifts = sortShiftEntriesForPay(fullShiftsRaw);
        if (fullShifts.length > 0) {
            monthlySalary += 2300;
            monthlySalary += additionalFullShiftHoursPay(fullShifts);
        }
    });
    // Only add extra hours at 225/hour (do not count as full shifts)
    const totalExtraHoursForMonth = monthlyShifts.reduce((sum, entry) => sum + (entry.extraHours && !isNaN(parseFloat(entry.extraHours)) ? parseFloat(entry.extraHours) : 0), 0);
    monthlySalary += totalExtraHoursForMonth * 225;

    // Covered shifts count for summary (only for selected month/year)
    const coveredShiftsCount = filteredExport.filter(entry => 
        validShifts.includes(entry.shift) && (!entry.extraHours || parseFloat(entry.extraHours) === 0)
    ).length;

    // Calculate monthly salary for selected month/year
    let exportMonthlySalary = 0;
    // Group filteredExport by date
    const exportShiftsByDay = {};
    filteredExport.forEach(entry => {
        if (!exportShiftsByDay[entry.date]) exportShiftsByDay[entry.date] = [];
        exportShiftsByDay[entry.date].push(entry);
    });
    Object.values(exportShiftsByDay).forEach(shifts => {
        const fullShiftsRaw = shifts.filter(entry => validShifts.includes(entry.shift) && (!entry.extraHours || parseFloat(entry.extraHours) === 0));
        const fullShifts = sortShiftEntriesForPay(fullShiftsRaw);
        if (fullShifts.length > 0) {
            exportMonthlySalary += 2300;
            exportMonthlySalary += additionalFullShiftHoursPay(fullShifts);
        }
    });
    const exportTotalExtraHours = filteredExport.reduce((sum, entry) => sum + (entry.extraHours && !isNaN(parseFloat(entry.extraHours)) ? parseFloat(entry.extraHours) : 0), 0);
    exportMonthlySalary += exportTotalExtraHours * 225;

    const summary = [
        ['Total Covered Shifts', coveredShiftsCount],
        ['Monthly Salary (Rs)', exportMonthlySalary]
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summary);

    // Create worksheet and workbook
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const selectedMonthName = monthNames[selectedMonthIdx];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
    XLSX.utils.book_append_sheet(wb, ws, `Shifts ${selectedMonthName}`);
    // Export to file
    const fileName = `shift_records_${selectedMonthName}_${yearSelect.value}.xlsx`;
    XLSX.writeFile(wb, fileName);
}

// Load SheetJS library if not present
(function() {
    if (!window.XLSX) {
        var script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        script.onload = function() {
            document.getElementById('exportXLSX').onclick = exportToXLSX;
        };
        document.head.appendChild(script);
    } else {
        document.getElementById('exportXLSX').onclick = exportToXLSX;
    }
})();

// Import XLSX functionality
function importFromXLSX(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames.includes('Shifts') ? 'Shifts' : workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet);
        // Convert to app format
        const shiftHistory = json.map(row => ({
            date: row.Date || '',
            shift: row.Shift || '',
            workstation: row.Workstation || '',
            extraStartTime: row['Extra Start Time'] || '',
            extraStopTime: row['Extra Stop Time'] || '',
            extraHours: row['Extra Hours'] || '',
            coveredFor: row['Covered For'] || '',
            salary: row.Salary || undefined
        })).filter(row => row.date && row.shift && row.workstation);
        localStorage.setItem('shiftHistory', JSON.stringify(shiftHistory));
        populateMonthYearSelectors(shiftHistory);
        loadShiftHistory();
        alert('Shift data imported!');
    };
    reader.readAsArrayBuffer(file);
}

document.getElementById('importXLSX').onclick = function() {
    document.getElementById('importFile').click();
};
document.getElementById('importFile').onchange = function(e) {
    const file = e.target.files[0];
    if (file) {
        importFromXLSX(file);
        e.target.value = '';
    }
};

// Auto-calculate extra hours from start/stop time
const extraStartTime = document.getElementById('extraStartTime');
const extraStopTime = document.getElementById('extraStopTime');
const extraHoursInput = document.getElementById('extraHours');
function updateExtraHoursFromTime() {
    const start = extraStartTime.value;
    const stop = extraStopTime.value;
    if (start && stop) {
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = stop.split(':').map(Number);
        let startMins = sh * 60 + sm;
        let endMins = eh * 60 + em;
        if (endMins < startMins) endMins += 24 * 60; // handle overnight
        const diff = (endMins - startMins) / 60;
        extraHoursInput.value = diff > 0 ? diff.toFixed(2) : '';
    }
}
extraStartTime.addEventListener('change', updateExtraHoursFromTime);
extraStopTime.addEventListener('change', updateExtraHoursFromTime);
extraHoursInput.addEventListener('input', function() {
    if (!extraHoursInput.value) {
        extraStartTime.value = '';
        extraStopTime.value = '';
    } else {
        // If user manually changes extraHours, clear start/stop time to avoid confusion
        extraStartTime.value = '';
        extraStopTime.value = '';
    }
});

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('service-worker.js');
  });
}

// Helper to get/set shift radio value
function getShiftValue() {
    const radios = document.getElementsByName('shift');
    for (const radio of radios) {
        if (radio.checked) return radio.value;
    }
    return '';
}
function setShiftValue(val) {
    const radios = document.getElementsByName('shift');
    for (const radio of radios) {
        radio.checked = (radio.value === val);
    }
}

// Helper to get/set workstation radio value
function getWorkstationValue() {
    const radios = document.getElementsByName('workstation');
    for (const radio of radios) {
        if (radio.checked) return radio.value;
    }
    return '';
}
function setWorkstationValue(val) {
    const radios = document.getElementsByName('workstation');
    for (const radio of radios) {
        radio.checked = (radio.value === val);
    }
    updateShiftRadioLabels();
}

function parseLocalYMD(ymd) {
    const p = ymd.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
}

/** Paid hours per scheduled shift (must match workstation schedule). Used for additional shifts: hours × 225. */
function getShiftPaidHours(workstation, shift, ymd) {
    if (!ymd || !shift) return 0;
    const ws = String(workstation);
    const d = parseLocalYMD(ymd);
    const friSat = d.getDay() === 5 || d.getDay() === 6;

    if (shift === 'NightLong') {
        if (ws === '6' && friSat) return 10;
        return 0;
    }

    switch (ws) {
        case '1':
        case '8':
            if (shift === 'Morning') return 7;
            if (shift === 'Evening') return 6;
            if (shift === 'Night') return 6;
            return 0;
        case '2':
        case '3':
        case '4':
        case '5':
            if (shift === 'Morning' || shift === 'Evening' || shift === 'Night') return 8;
            return 0;
        case '6':
            if (shift === 'Morning') return 6;
            if (friSat) {
                if (shift === 'Evening') return 10;
                if (shift === 'Night') return 9;
            } else {
                if (shift === 'Evening') return 5;
                if (shift === 'Night') return 9;
            }
            return 0;
        case '7':
        case '10':
            if (shift === 'Morning') return 9;
            if (shift === 'Night') return 9;
            return 0;
        case '9':
            if (shift === 'Morning') return 8;
            if (shift === 'Evening') return 6;
            if (shift === 'Night') return 6;
            return 0;
        case '11':
            if (shift === 'Morning') return 6;
            if (shift === 'Night') return 10;
            return 0;
        case '12':
            if (shift === 'Morning' || shift === 'Evening' || shift === 'Night') return 6;
            return 0;
        default:
            return 0;
    }
}

function sortShiftEntriesForPay(entries) {
    const shiftOrder = { Morning: 1, Evening: 2, Night: 3, NightLong: 4 };
    return [...entries].sort((a, b) => {
        const oa = shiftOrder[a.shift] || 99;
        const ob = shiftOrder[b.shift] || 99;
        if (oa !== ob) return oa - ob;
        return String(a.workstation).localeCompare(String(b.workstation), undefined, { numeric: true });
    });
}

function additionalFullShiftHoursPay(sortedFullShifts) {
    let sum = 0;
    for (let i = 1; i < sortedFullShifts.length; i++) {
        sum += getShiftPaidHours(sortedFullShifts[i].workstation, sortedFullShifts[i].shift, sortedFullShifts[i].date) * 225;
    }
    return sum;
}

/** Plain-text captions for shift radios and schedule lines (values still Morning/Evening/Night). */
function getShiftCaptionsForWorkstation(workstation, ymd) {
    const ws = String(workstation);
    const d = parseLocalYMD(ymd);
    const friSat = d.getDay() === 5 || d.getDay() === 6;

    switch (ws) {
        case '1':
        case '8':
            return {
                Morning: '5:30 AM – 12:30 PM (7 hrs)',
                Evening: '5:30 PM – 11:30 PM (6 hrs)',
                Night: '11:30 PM – 5:30 AM (6 hrs)'
            };
        case '2':
        case '3':
        case '4':
        case '5':
            return {
                Morning: '5:30 AM – 1:30 PM (8 hrs)',
                Evening: '1:30 PM – 9:30 PM (8 hrs)',
                Night: '9:30 PM – 5:30 AM (8 hrs)'
            };
        case '6':
            if (friSat) {
                return {
                    Morning: '5:30 AM – 11:30 AM (6 hrs)',
                    Evening: '7:30 PM – 5:30 AM (10 hrs, Fri–Sat) (evening)',
                    Night: '— (Sun–Thu: 12:30 AM – 9:30 AM, 9 hrs)'
                };
            }
            return {
                Morning: '5:30 AM – 11:30 AM (6 hrs)',
                Evening: '7:30 PM – 12:30 AM (5 hrs, Sun–Thu) (evening)',
                Night: '12:30 AM – 9:30 AM (9 hrs, Sun–Thu)'
            };
        case '7':
        case '10':
            return {
                Morning: '5:30 AM – 2:30 PM (9 hrs)',
                Night: '8:30 PM – 5:30 AM (9 hrs)'
            };
        case '9':
            return {
                Morning: '5:30 AM – 1:30 PM (8 hrs)',
                Evening: '5:30 PM – 11:30 PM (6 hrs)',
                Night: '11:30 PM – 5:30 AM (6 hrs)'
            };
        case '11':
            return {
                Morning: '5:30 AM – 11:30 AM (6 hrs)',
                Night: '11:30 PM – 9:30 AM (10 hrs)'
            };
        case '12':
            return {
                Morning: '5:30 AM – 11:30 AM (6 hrs)',
                Evening: '5:30 PM – 11:30 PM (6 hrs)',
                Night: '11:30 PM – 5:30 AM (6 hrs)'
            };
        default:
            return null;
    }
}

/** Returns [{ shift, line }] for the hint panel */
function getWorkstationScheduleLines(workstation, ymd) {
    const c = getShiftCaptionsForWorkstation(workstation, ymd);
    if (!c) return [];
    const ws = String(workstation);
    const d = parseLocalYMD(ymd);
    const friSat = d.getDay() === 5 || d.getDay() === 6;
    const em = '<strong>Morning:</strong> ';
    const ee = '<strong>Evening:</strong> ';
    const en = '<strong>Night:</strong> ';
    const rows = [{ shift: 'Morning', line: em + c.Morning }];
    if (c.Evening !== undefined) {
        rows.push({ shift: 'Evening', line: ee + c.Evening });
    }
    if (ws === '6' && friSat) {
        rows.push({ shift: 'Night', line: '<strong>Night (Sun–Thu only):</strong> 12:30 AM – 9:30 AM (9 hrs, Sun–Thu)' });
    } else {
        rows.push({ shift: 'Night', line: en + c.Night });
    }
    return rows;
}

const SHIFT_LABELS_DEFAULT = { Morning: 'Morning', Evening: 'Evening', Night: 'Night' };

function preferNightShiftRadio() {
    const nightRadio = document.querySelector('#shiftRadios input[name="shift"][value="Night"]');
    if (nightRadio) nightRadio.checked = true;
}

function preferEveningShiftRadio() {
    const eveningRadio = document.querySelector('#shiftRadios input[name="shift"][value="Evening"]');
    if (eveningRadio) eveningRadio.checked = true;
}

function updateShiftOptionsVisibility() {
    const eveningLabel = document.getElementById('shiftEveningLabel');
    const nightLabel = document.getElementById('shiftNightLabel');
    const ws = getWorkstationValue();
    const dateEl = document.getElementById('date');
    const ymd = (dateEl && dateEl.value) ? dateEl.value : new Date().toISOString().slice(0, 10);
    const d = parseLocalYMD(ymd);
    const friSat = d.getDay() === 5 || d.getDay() === 6;

    if (eveningLabel) {
        const hideEvening = ws === '7' || ws === '10' || ws === '11';
        eveningLabel.style.display = hideEvening ? 'none' : '';
        if (hideEvening) {
            const er = eveningLabel.querySelector('input[name="shift"][value="Evening"]');
            if (er && er.checked) {
                er.checked = false;
                preferNightShiftRadio();
            }
        }
    }

    if (nightLabel) {
        const hideNight = ws === '6' && friSat;
        nightLabel.style.display = hideNight ? 'none' : '';
        if (hideNight) {
            const nr = nightLabel.querySelector('input[name="shift"][value="Night"]');
            if (nr && nr.checked) {
                nr.checked = false;
                preferEveningShiftRadio();
            }
        }
    }
}

function updateShiftRadioLabels() {
    const root = document.getElementById('shiftRadios');
    if (!root) return;
    const ws = getWorkstationValue();
    const dateEl = document.getElementById('date');
    const ymd = (dateEl && dateEl.value) ? dateEl.value : new Date().toISOString().slice(0, 10);
    const captions = ws ? getShiftCaptionsForWorkstation(ws, ymd) : null;
    const map = captions || SHIFT_LABELS_DEFAULT;
    root.querySelectorAll('.shift-caption[data-shift]').forEach(span => {
        const key = span.getAttribute('data-shift');
        if (map[key] !== undefined) span.textContent = map[key];
    });
    updateShiftOptionsVisibility();
}

function updateWorkstationScheduleHint() {
    const el = document.getElementById('workstationScheduleHint');
    if (!el) return;
    const ws = getWorkstationValue();
    const dateEl = document.getElementById('date');
    const ymd = (dateEl && dateEl.value) ? dateEl.value : new Date().toISOString().slice(0, 10);

    if (!ws) {
        el.innerHTML = '<p>Select a workstation to see shift times for the chosen date.</p>';
        return;
    }

    const rows = getWorkstationScheduleLines(ws, ymd);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayLabel = days[parseLocalYMD(ymd).getDay()];
    let html = '<p><strong>Workstation ' + ws + '</strong> — ' + dayLabel + ' · ' + ymd + '</p><ul>';
    rows.forEach(r => {
        html += '<li>' + r.line + '</li>';
    });
    html += '</ul>';
    if (String(ws) === '6') {
        html += '<p class="ws6-note">Workstation 6: evening/night blocks differ on Fri–Sat vs Sun–Thu (uses the date above).</p>';
    }
    el.innerHTML = html;
}

(function wireWorkstationScheduleHint() {
    const dateEl = document.getElementById('date');
    if (dateEl) {
        dateEl.addEventListener('change', function () {
            updateShiftRadioLabels();
            updateWorkstationScheduleHint();
        });
    }
    document.querySelectorAll('input[name="workstation"]').forEach(r => {
        r.addEventListener('change', function () {
            updateShiftRadioLabels();
            updateWorkstationScheduleHint();
        });
    });
    updateShiftRadioLabels();
    updateWorkstationScheduleHint();
})();