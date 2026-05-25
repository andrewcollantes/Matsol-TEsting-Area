//  Detail popup 

const detailPopup = document.getElementById('detailPopup');
const detailList = document.getElementById('detailList');
const closePopup = document.getElementById('closePopup');

window.showDetails = function (index) {
    const record = allMachines[index];
    if (!record) return;

    if (typeof record._runningSeconds === 'undefined') {
        record._runningSeconds = parseRunningHoursToSeconds(record.runningHours);
    }

    const submittedByText = formatTechnicianInline(record.submittedBy || 'Unknown User');

    // Pass full record so anchor date is resolved correctly
    const nextMaintenance = calculateNextMaintenance(record.dateInstalled, record._runningSeconds, record);
    const maintenanceStatus = getMaintenanceStatus(record.dateInstalled, record._runningSeconds, record, 30);
    const { unitKey, modelKey } = getPartsCatalogLocation(record);
    const partsForModel = unitKey && modelKey ? ((PARTS_CATALOG[unitKey] || {})[modelKey] || []) : [];
    const currentHours = (record._runningSeconds || 0) / 3600;

    const detailParts = [];

    if (maintenanceStatus.label !== '\u2014') {
        detailParts.push({
            name: 'MAINTENANCE',
            date: maintenanceStatus.label
        });
    }

    partsForModel.forEach(part => {
        const partStatus = getPartStatus(currentHours, part, record);
        detailParts.push({
            name: part.name,
            date: partStatus.label || '\u2014'
        });
    });

    const detailListItems = detailParts.length
        ? detailParts.map(item => `<li class="detail-parts-item">
                <span class="detail-parts-name">${escapeHtml(item.name)}</span>
                <span class="detail-parts-date">${escapeHtml(item.date)}</span>
            </li>`).join('')
        : `<div class="detail-parts-empty">No parts data found for this model.</div>`;

    const statusClass = (record.status || '').toLowerCase() === 'active' ? 'status-active'
        : (record.status || '').toLowerCase() === 'decommissioned' ? 'status-decommissioned'
            : 'status-inactive';

    detailList.innerHTML = `
        <div class="detail-identity">
            <div class="detail-identity-cell">
                <div class="detail-identity-label">Unit</div>
                <div class="detail-identity-value">${escapeHtml(record.unit || '\u2014')}</div>
            </div>
            <div class="detail-identity-cell">
                <div class="detail-identity-label">Model</div>
                <div class="detail-identity-value">${escapeHtml(record.model || '\u2014')}</div>
            </div>
            <div class="detail-identity-cell">
                <div class="detail-identity-label">Serial No.</div>
                <div class="detail-identity-value">${escapeHtml(record.serialNo || '\u2014')}</div>
            </div>
        </div>
        <div class="detail-field">
            <span class="detail-field-label">Installed</span>
            <span class="detail-field-value">${formatDateDisplay(record.dateInstalled)}</span>
        </div>
        <div class="detail-field">
            <span class="detail-field-label">Running Hours</span>
            <span class="detail-field-value">${formatRunningHoursOnly(record._runningSeconds)} hrs</span>
        </div>
        <div class="detail-field">
            <span class="detail-field-label">Maintenance</span>
            <span class="detail-field-value${nextMaintenance === 'Overdue' ? ' overdue' : ''}" id="detail-next-maintenance">${nextMaintenance}</span>
        </div>
        <div class="detail-field">
            <span class="detail-field-label">Status</span>
            <span class="detail-field-value"><span class="status-badge ${statusClass}">${escapeHtml(record.status || '\u2014')}</span></span>
        </div>
        <div class="detail-field">
            <span class="detail-field-label">Description</span>
            <span class="detail-field-value" style="${!record.description ? 'color:var(--muted);font-style:italic;' : ''}">${escapeHtml(record.description || 'No description')}</span>
        </div>
        <div class="detail-field" style="border-bottom:none;">
            <span class="detail-field-label">Submitted By</span>
            <span class="detail-field-value">${escapeHtml(submittedByText)}</span>
        </div>
        <div class="detail-parts-section">
            <div class="detail-parts-heading">Parts / Maintenance</div>
            <ul class="detail-parts-list">${detailListItems}</ul>
        </div>
    `;

    // Show/hide View History button
    const viewHistoryBtn = document.getElementById('viewHistoryBtn');
    viewHistoryBtn.style.display = 'inline-flex';
    viewHistoryBtn.onclick = () => openHistoryModal(index);

    // Hook up action buttons
    document.getElementById('btn-pm').onclick = () => {
        detailPopup.style.display = 'none';
        openEditModal(index, ACTIVITY_TYPES.PREVENTIVE_MAINTENANCE);
    };
    document.getElementById('btn-parts').onclick = () => {
        detailPopup.style.display = 'none';
        openEditModal(index, ACTIVITY_TYPES.PARTS_REPLACEMENT);
    };
    document.getElementById('btn-cannibalize').onclick = () => {
        detailPopup.style.display = 'none';
        openAdHocModal(index, ACTIVITY_TYPES.CANNIBALIZE);
    };
    document.getElementById('btn-pullout').onclick = () => {
        detailPopup.style.display = 'none';
        openAdHocModal(index, ACTIVITY_TYPES.PULL_OUT);
    };

    detailPopup.style.display = 'grid';
    currentDetailIndex = index;
};

closePopup.addEventListener('click', () => {
    detailPopup.style.display = 'none';
    currentDetailIndex = null;
});

detailPopup.addEventListener('click', (e) => {
    if (e.target === detailPopup) {
        detailPopup.style.display = 'none';
        currentDetailIndex = null;
    }
});

//  Unit update history builder ΓöÇ

function buildHistoryRows(record) {
    const rows = [];
    const installSnapshot = {
        runningHours: Number(record.initialRunningHours ?? record.runningHours ?? 0) || 0,
        status: String(record.initialStatus || record.status || '\u2014'),
        description: String(record.initialDescription || ''),
        maintenanceServiceDate: String(record.initialMaintenanceServiceDate || ''),
        partServiceDates: clonePartMap(record.initialPartServiceDates || record.partServiceDates),
        partServiceHours: clonePartMap(record.initialPartServiceHours || record.partServiceHours)
    };

    // Original install row
    rows.push({
        date: record.dateInstalled,
        tech: record.submittedBy || 'Unknown User',
        status: installSnapshot.status,
        isOriginal: true,
        machineIndex: -1,
        detail: installSnapshot
    });
    // Additional updates
    if (Array.isArray(record.updates)) {
        record.updates.forEach((u, updateIndex) => {
            const snapshot = cloneUpdateEntry(u);
            rows.push({
                date: snapshot.date || '\u2014',
                tech: snapshot.submittedBy || 'Unknown User',
                status: snapshot.status || '\u2014',
                isOriginal: false,
                detail: snapshot,
                machineIndex: updateIndex
            });
        });
    }
    // Newest updates should appear first in Machine History Records.
    return rows.reverse();
}

function getMaintenanceAndPartUpdates(record, row, rowIndex) {
    const result = [];
    const updateDetail = row && row.detail ? row.detail : null;

    if (row && row.isOriginal) {
        return ['UNIT INSTALLATION'];
    }

    // For ad-hoc activities (Pull Out, Cannibalize), no scheduled maintenance/parts apply
    const activityType = updateDetail && updateDetail.activityType ? updateDetail.activityType : ACTIVITY_TYPES.PREVENTIVE_MAINTENANCE;
    if (!SCHEDULED_ACTIVITY_TYPES.has(activityType)) {
        if (activityType === ACTIVITY_TYPES.PULL_OUT) {
            return [];
        }

        if (activityType === ACTIVITY_TYPES.CANNIBALIZE || activityType === ACTIVITY_TYPES.PARTS_RETURN) {
            let previousParts = [];
            if (typeof row.machineIndex === 'number' && row.machineIndex > 0 && Array.isArray(record.updates)) {
                for (let i = row.machineIndex - 1; i >= 0; i--) {
                    const prevUpdate = record.updates[i] || {};
                    const prevType = String(prevUpdate.activityType || '').trim();
                    if (prevType === ACTIVITY_TYPES.CANNIBALIZE || prevType === ACTIVITY_TYPES.PARTS_RETURN) {
                        previousParts = Array.isArray(prevUpdate.partsUpdated) ? prevUpdate.partsUpdated : [];
                        break;
                    }
                }
            }

            const currentParts = updateDetail && Array.isArray(updateDetail.partsUpdated)
                ? updateDetail.partsUpdated
                : [];

            const added = currentParts.filter(p => !previousParts.includes(p));
            const removed = previousParts.filter(p => !currentParts.includes(p));
            const changedParts = [...added, ...removed];

            const uniqueParts = changedParts
                .map(name => String(name || '').trim())
                .filter(Boolean)
                .filter((name, idx, arr) => arr.findIndex(v => v.toLowerCase() === name.toLowerCase()) === idx);

            return uniqueParts;
        }

        return [];
    }

    if (updateDetail && Array.isArray(updateDetail.partsUpdated) && updateDetail.partsUpdated.length) {
        updateDetail.partsUpdated.forEach(name => result.push(String(name)));
    } else if (updateDetail && Array.isArray(record.updates) && row.machineIndex >= 0) {
        const currentUpdate = record.updates[row.machineIndex] || {};
        const previousUpdate = record.updates[row.machineIndex - 1] || {};
        const changedBySnapshot = getChangedPartNames(previousUpdate.partServiceDates, currentUpdate.partServiceDates);
        changedBySnapshot.forEach(name => result.push(String(name)));
    }

    const maintenanceUpdated = !!(updateDetail && updateDetail.maintenanceUpdated);
    if (maintenanceUpdated) {
        result.unshift('MAINTENANCE');
    }

    const unique = result
        .map(name => String(name || '').trim())
        .filter(Boolean)
        .filter((name, idx, arr) => arr.findIndex(v => v.toLowerCase() === name.toLowerCase()) === idx);

    // Fallback for older records with no per-update part metadata.
    if (!unique.length && row && row.machineIndex === (Array.isArray(record.updates) ? record.updates.length - 1 : -1)) {
        const todayKey = toDateKey(row.date);
        const maintenanceDateKey = toDateKey(record.maintenanceServiceDate);

        if (todayKey && maintenanceDateKey && todayKey === maintenanceDateKey) {
            unique.push('MAINTENANCE');
        }

        const partDates = record.partServiceDates && typeof record.partServiceDates === 'object' ? record.partServiceDates : {};
        Object.keys(partDates).forEach(partName => {
            if (toDateKey(partDates[partName]) === todayKey) {
                unique.push(partName);
            }
        });
    }

    return unique;
}

function findReportForHistoryRow(record, row) {
    if (!record) return null;
    if (!Array.isArray(record.reports) || !record.reports.length) return null;

    if (row.isOriginal) {
        const installReport = record.reports.find(r => r && (r.updateIndex === null || r.updateIndex === undefined));
        if (installReport) return installReport;

        const installDateKey = toDateKey(record.dateInstalled);
        const byDate = record.reports.find(r => toDateKey(r && r.date) === installDateKey);
        if (byDate) return byDate;

        return record.reports[0] || null;
    }

    const updateDetail = row.detail || {};
    if (updateDetail.report && typeof updateDetail.report === 'object') {
        return updateDetail.report;
    }

    if (Number.isInteger(row.machineIndex) && row.machineIndex >= 0) {
        const direct = record.reports.find(r => Number(r.updateIndex) === row.machineIndex);
        if (direct) return direct;
    }

    if (Number.isInteger(row.machineIndex) && row.machineIndex >= 0 && record.reports[row.machineIndex]) {
        return record.reports[row.machineIndex];
    }

    const rowDateKey = toDateKey(row.date);
    const rowTech = normalizeTechnicianName(row.tech || '').toLowerCase();

    for (let i = record.reports.length - 1; i >= 0; i -= 1) {
        const candidate = record.reports[i] || {};
        const reportDateKey = toDateKey(candidate.date);
        const reportTech = normalizeTechnicianName(candidate.submittedBy || '').toLowerCase();
        if (reportDateKey && rowDateKey && reportDateKey === rowDateKey && (!rowTech || rowTech === reportTech)) {
            return candidate;
        }
    }

    return null;
}

function setReportViewText(id, value, { preserveBreaks = false } = {}) {
    const el = document.getElementById(id);
    if (!el) return;

    const text = String(value || '').trim();
    if (!text) {
        el.textContent = '\u2014';
        el.classList.add('report-view-empty');
        return;
    }

    el.classList.remove('report-view-empty');

    if (preserveBreaks) {
        el.innerHTML = escapeHtml(text).replace(/\n/g, '<br>');
    } else {
        el.textContent = text;
    }
}

//  History modal ΓöÇ

const historyPopup = document.getElementById('historyPopup');
const historyList = document.getElementById('historyList');
const closeHistoryPopup = document.getElementById('closeHistoryPopup');

function openHistoryModal(index) {
    const record = allMachines[index];
    if (!record) return;

    const rows = buildHistoryRows(record);

    historyList.innerHTML = rows.map((row, rowIndex) => {
        const activityType = row.isOriginal
            ? 'Installation'
            : (row.detail && row.detail.activityType ? row.detail.activityType : ACTIVITY_TYPES.PREVENTIVE_MAINTENANCE);
        const isAdHoc = !row.isOriginal && !SCHEDULED_ACTIVITY_TYPES.has(activityType) && activityType !== 'Installation';
        const report = isAdHoc ? null : findReportForHistoryRow(record, row);
        const refNo = isAdHoc ? '—' : (report && report.refNo ? report.refNo : '—');
        const activityBadgeClass = isAdHoc ? 'activity-badge activity-badge-adhoc' : 'activity-badge';
        return `
        <tr class="history-record-row" data-machine-index="${index}" data-row-index="${rowIndex}" tabindex="0" role="button" aria-label="View report for ${formatDateDisplay(row.date)}">
            <td>${formatDateDisplay(row.date)}</td>
            <td class="history-tech-cell">${formatTechnicianLines(row.tech)}</td>
            <td><span class="${activityBadgeClass}">${escapeHtml(activityType)}</span></td>
            <td>${refNo}</td>
        </tr>
    `;
    }).join('');

    historyList.querySelectorAll('.history-record-row').forEach(rowEl => {
        rowEl.addEventListener('click', () => {
            const machineIndex = Number(rowEl.dataset.machineIndex);
            const targetRowIndex = Number(rowEl.dataset.rowIndex);
            openHistoryReportModal(machineIndex, targetRowIndex);
        });

        rowEl.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            const machineIndex = Number(rowEl.dataset.machineIndex);
            const targetRowIndex = Number(rowEl.dataset.rowIndex);
            openHistoryReportModal(machineIndex, targetRowIndex);
        });
    });

    historyPopup.style.display = 'grid';
}

closeHistoryPopup.addEventListener('click', () => {
    historyPopup.style.display = 'none';
});

historyPopup.addEventListener('click', (e) => {
    if (e.target === historyPopup) {
        historyPopup.style.display = 'none';
    }
});

const historyReportPopup = document.getElementById('historyReportPopup');
const closeHistoryReportPopup = document.getElementById('closeHistoryReportPopup');

function closeHistoryReportModal() {
    if (!historyReportPopup) return;
    historyReportPopup.style.display = 'none';
}

function openHistoryReportModal(machineIndex, rowIndex) {
    const record = allMachines[machineIndex];
    if (!record) return;

    const rows = buildHistoryRows(record);
    const row = rows[rowIndex];
    if (!row) return;

    const updateDetail = row.detail || {};
    const activityType = row.isOriginal
        ? 'Installation'
        : (updateDetail.activityType || ACTIVITY_TYPES.PREVENTIVE_MAINTENANCE);
    const activityKey = String(activityType || '').trim().toLowerCase();
    const isPullOut = activityKey === 'pull out';
    const isCannibalize = activityKey === 'cannibalize';
    const isAdHoc = isPullOut || isCannibalize;

    const report = isAdHoc ? null : findReportForHistoryRow(record, row);
    const runningHours = Number(updateDetail.runningHours) || 0;

    const maintenanceAndParts = getMaintenanceAndPartUpdates(record, row, rowIndex);
    const maintenanceAndPartsList = document.getElementById('history-report-maintenance-parts-list');

    setReportViewText('history-report-date', formatDateDisplay(row.date));
    const refNo = report && report.refNo ? report.refNo : '—';
    setReportViewText('history-report-refno', refNo);
    const submittedSource = report && report.submittedBy
        ? report.submittedBy
        : (row.tech || 'Unknown User');
    const submittedParts = splitTechnicianNames(submittedSource);
    const submittedByForView = submittedParts[0] || normalizeTechnicianName(submittedSource) || 'Unknown User';

    setReportViewText('history-report-submitted-by', submittedByForView);
    setReportViewText('history-report-unit', record.unit || '\u2014');
    setReportViewText('history-report-model', record.model || '\u2014');
    setReportViewText('history-report-serial', record.serialNo || '\u2014');
    if (isAdHoc) {
        setReportViewText('history-report-running-hours', '');
        setReportViewText('history-report-status', '');
    } else {
        setReportViewText('history-report-running-hours', `${runningHours} hrs`);
        setReportViewText('history-report-status', updateDetail.status || row.status || '\u2014');
    }
    setReportViewText('history-report-description', updateDetail.description || '', { preserveBreaks: true });

    if (maintenanceAndPartsList) {
        if (isPullOut) {
            maintenanceAndPartsList.innerHTML = '<li class="report-view-empty">\u2014</li>';
        } else if (!maintenanceAndParts.length) {
            maintenanceAndPartsList.innerHTML = '<li class="report-view-empty">No maintenance or parts updates recorded.</li>';
        } else {
            maintenanceAndPartsList.innerHTML = maintenanceAndParts
                .map(item => `<li>${escapeHtml(item)}</li>`)
                .join('');
        }
    }

    if (report) {
        const submittedNames = splitTechnicianNames(report.submittedBy || '');
        const submittedPrimary = submittedNames[0] || '';
        const legacyTechnicians = submittedNames.slice(1);
        const savedTechnicians = Array.isArray(report.technicians)
            ? report.technicians.flatMap(name => splitTechnicianNames(name))
            : [];
        const allTechnicians = [submittedPrimary, ...legacyTechnicians, ...savedTechnicians]
            .filter(Boolean)
            .filter((name, idx, arr) => arr.findIndex(v => v.toLowerCase() === name.toLowerCase()) === idx);
        const techniciansText = allTechnicians.join(', ');

        setReportViewText('history-report-technicians', techniciansText);
        setReportViewText('history-report-problem', report.problem || '', { preserveBreaks: true });
        setReportViewText('history-report-action', report.action || '', { preserveBreaks: true });
        setReportViewText('history-report-recommendation', report.recommendation || '', { preserveBreaks: true });
    } else {
        const adHocTechs = Array.isArray(updateDetail.technicians)
            ? updateDetail.technicians.flatMap(name => splitTechnicianNames(name))
            : [];
        const submittedNames = splitTechnicianNames(row.tech || '');
        const submittedPrimary = submittedNames[0] || normalizeTechnicianName(row.tech || '') || 'Unknown User';
        const allTechnicians = [submittedPrimary, ...adHocTechs]
            .filter(Boolean)
            .filter((name, idx, arr) => arr.findIndex(v => v.toLowerCase() === name.toLowerCase()) === idx);
        const techniciansText = allTechnicians.join(', ');

        setReportViewText('history-report-technicians', techniciansText);
        if (isAdHoc) {
            setReportViewText('history-report-problem', '', { preserveBreaks: true });
            setReportViewText('history-report-action', '', { preserveBreaks: true });
            setReportViewText('history-report-recommendation', '', { preserveBreaks: true });
        } else {
            setReportViewText('history-report-problem', '', { preserveBreaks: true });
            setReportViewText('history-report-action', '', { preserveBreaks: true });
            setReportViewText('history-report-recommendation', '', { preserveBreaks: true });
        }
    }

    if (historyReportPopup) {
        historyReportPopup.style.display = 'grid';
    }
}

if (closeHistoryReportPopup) {
    closeHistoryReportPopup.addEventListener('click', closeHistoryReportModal);
}

if (historyReportPopup) {
    historyReportPopup.addEventListener('click', (event) => {
        if (event.target === historyReportPopup) {
            closeHistoryReportModal();
        }
    });
}