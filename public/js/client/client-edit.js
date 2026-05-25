//  Edit / Update modal ΓöÇ

const editPopup = document.getElementById('editPopup');
const closeEditPopup = document.getElementById('closeEditPopup');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const editForm = document.getElementById('editForm');
const confirmOverlay = document.getElementById('confirmOverlay');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');
const confirmOkBtn = document.getElementById('confirmOkBtn');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');
const adHocPopup = document.getElementById('adHocPopup');
const closeAdHocPopup = document.getElementById('closeAdHocPopup');
const cancelAdHocBtn = document.getElementById('cancelAdHocBtn');
const adHocForm = document.getElementById('adHocForm');
const adHocDescriptionInput = document.getElementById('ad-hoc-description');
const adHocTechniciansInput = document.getElementById('ad-hoc-technicians');
const adHocTechDropdown = document.getElementById('ad-hoc-tech-dropdown');
let adHocTechFocusedIndex = -1;
let editDraft = null;
let activeConfirmResolver = null;
let adHocDraft = null;
window.pendingMachineUpdate = null;

function showConfirmDialog(options = {}) {
    const {
        title = 'Please Confirm',
        message = 'Are you sure?',
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        tone = 'default'
    } = options;

    if (!confirmOverlay || !confirmTitle || !confirmMessage || !confirmOkBtn || !confirmCancelBtn) {
        return Promise.resolve(window.confirm(message));
    }

    if (activeConfirmResolver) {
        activeConfirmResolver(false);
        activeConfirmResolver = null;
    }

    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    confirmOkBtn.textContent = confirmText;
    confirmCancelBtn.textContent = cancelText;

    confirmOkBtn.classList.remove('is-warning', 'is-danger');
    if (tone === 'warning') confirmOkBtn.classList.add('is-warning');
    if (tone === 'danger') confirmOkBtn.classList.add('is-danger');

    confirmOverlay.style.display = 'grid';
    requestAnimationFrame(() => confirmOkBtn.focus());

    return new Promise((resolve) => {
        activeConfirmResolver = resolve;
    });
}

function resolveConfirmDialog(result) {
    if (!activeConfirmResolver) return;
    const resolver = activeConfirmResolver;
    activeConfirmResolver = null;
    confirmOverlay.style.display = 'none';
    resolver(result);
}

function buildAdHocDraft(record, index, activityType) {
    return {
        index,
        activityType: activityType || ACTIVITY_TYPES.CANNIBALIZE,
        description: record.description || '',
        selectedParts: []
    };
}

function buildPendingMachineUpdate(record, index) {
    if (!record || !editDraft) return null;

    const activityType = editDraft.activityType || ACTIVITY_TYPES.PREVENTIVE_MAINTENANCE;
    const isScheduled = SCHEDULED_ACTIVITY_TYPES.has(activityType);
    const newRunningHours = parseInt(document.getElementById('edit-runningHours').value, 10) || 0;
    const newStatus = document.getElementById('edit-status').value;
    const newDescription = document.getElementById('edit-description').value;

    const previousMaintenanceServiceDate = String(record.maintenanceServiceDate || '');
    const previousPartServiceDates = clonePartMap(record.partServiceDates);
    const todayStr = getTodayDateString();

    const nextMaintenanceServiceDate = isScheduled
        ? (activityType === ACTIVITY_TYPES.PREVENTIVE_MAINTENANCE
            ? String(editDraft.maintenanceServiceDate || todayStr)
            : String(editDraft.maintenanceServiceDate || ''))
        : previousMaintenanceServiceDate;

    const nextPartServiceDates = isScheduled
        ? clonePartMap(editDraft.partServiceDates)
        : clonePartMap(record.partServiceDates);

    const rawChangedParts = isScheduled ? getChangedPartNames(previousPartServiceDates, nextPartServiceDates) : [];
    const adjustedPartSet = new Set(
        editDraft.adjustedPartDates
            ? Object.keys(editDraft.adjustedPartDates).map(name => name.toLowerCase())
            : []
    );
    const changedParts = rawChangedParts.filter(name => !adjustedPartSet.has(String(name || '').toLowerCase()));

    return {
        recordIndex: index,
        activityType,
        runningHours: newRunningHours,
        status: newStatus,
        description: newDescription,
        maintenanceUpdated: isScheduled && previousMaintenanceServiceDate !== nextMaintenanceServiceDate,
        maintenanceServiceDate: nextMaintenanceServiceDate,
        partsUpdated: changedParts,
        partServiceDates: nextPartServiceDates,
        partServiceHours: isScheduled && editDraft ? clonePartMap(editDraft.partServiceHours) : clonePartMap(record.partServiceHours)
    };
}

function getLatestCannibalizedParts(record) {
    const updates = Array.isArray(record && record.updates) ? record.updates : [];

    for (let index = updates.length - 1; index >= 0; index -= 1) {
        const update = updates[index] || {};
        const type = String(update.activityType || '').trim();
        if (type === ACTIVITY_TYPES.CANNIBALIZE || type === ACTIVITY_TYPES.PARTS_RETURN) {
            return Array.isArray(update.partsUpdated) ? [...update.partsUpdated] : [];
        }
    }

    return [];
}

function closeAdHocTechDropdown() {
    if (!adHocTechDropdown) return;
    adHocTechDropdown.classList.remove('open');
    adHocTechFocusedIndex = -1;
}

function insertAdHocTechnician(name) {
    if (!adHocTechniciansInput) return;

    const draft = getTechnicianDraftState(adHocTechniciansInput.value);
    const merged = [...draft.committed, name]
        .filter(Boolean)
        .filter((value, idx, arr) => arr.findIndex(v => v.toLowerCase() === value.toLowerCase()) === idx);

    adHocTechniciansInput.value = merged.length ? `${merged.join(', ')}, ` : '';
    closeAdHocTechDropdown();
    adHocTechniciansInput.focus();
}

function renderAdHocTechDropdown() {
    if (!adHocTechniciansInput || !adHocTechDropdown) return;

    const draft = getTechnicianDraftState(adHocTechniciansInput.value);
    const committedSet = new Set(draft.committed.map(name => name.toLowerCase()));

    let options = getTechnicianPool().filter(name => !committedSet.has(name.toLowerCase()));

    if (draft.searchTerm) {
        const q = draft.searchTerm.toLowerCase();
        options = options.filter(name => name.toLowerCase().includes(q));
    }

    if (!options.length) {
        adHocTechDropdown.innerHTML = '<li class="report-tech-empty">No active users found.</li>';
        adHocTechDropdown.classList.add('open');
        return;
    }

    adHocTechDropdown.innerHTML = options.map((name, index) =>
        `<li class="report-tech-item${index === adHocTechFocusedIndex ? ' is-active' : ''}" data-name="${escapeHtml(name)}">${escapeHtml(name)}</li>`
    ).join('');

    adHocTechDropdown.classList.add('open');

    adHocTechDropdown.querySelectorAll('.report-tech-item').forEach(item => {
        item.addEventListener('mousedown', (event) => {
            event.preventDefault();
            const selected = item.dataset.name || '';
            insertAdHocTechnician(selected);
        });
    });
}

function closeAdHocModal() {
    if (!adHocPopup) return;
    adHocPopup.style.display = 'none';
    adHocDraft = null;
    closeAdHocTechDropdown();
}

function syncAdHocSelectedParts() {
    if (!adHocDraft) return;

    const partsList = document.getElementById('ad-hoc-parts-list');
    if (!partsList) {
        adHocDraft.selectedParts = [];
        return;
    }

    adHocDraft.selectedParts = Array.from(partsList.querySelectorAll('input[type="checkbox"]:checked'))
        .map(input => decodeURIComponent(input.dataset.name || ''))
        .filter(Boolean);
}

function renderAdHocPartsList(record, activityType, selectedParts = []) {
    const partsSection = document.getElementById('ad-hoc-parts-section');
    const partsList = document.getElementById('ad-hoc-parts-list');
    if (!partsSection || !partsList) return;

    const isAdHocPartsActivity = activityType === ACTIVITY_TYPES.CANNIBALIZE || activityType === ACTIVITY_TYPES.PARTS_RETURN;
    partsSection.style.display = isAdHocPartsActivity ? '' : 'none';
    if (!isAdHocPartsActivity) return;

    const selectedSet = new Set(
        (Array.isArray(selectedParts) ? selectedParts : [])
            .map(name => String(name || '').trim())
            .filter(Boolean)
            .map(name => name.toLowerCase())
    );

    const { unitKey, modelKey } = getPartsCatalogLocation(record);
    const parts = unitKey && modelKey ? ((PARTS_CATALOG[unitKey] || {})[modelKey] || []) : [];

    if (!parts.length) {
        partsList.innerHTML = '<div class="ad-hoc-parts-empty">No parts listed for this model.</div>';
        return;
    }

    partsList.innerHTML = parts.map(part => {
        const encodedName = encodeURIComponent(part.name || '');
        const isSelected = selectedSet.has(String(part.name || '').trim().toLowerCase());
        return `
            <label class="ad-hoc-part-item${isSelected ? ' is-selected' : ''}">
                <input type="checkbox" data-name="${encodedName}"${isSelected ? ' checked' : ''}>
                <span class="ad-hoc-part-name">${escapeHtml(part.name || '')}</span>
            </label>
        `;
    }).join('');

    partsList.querySelectorAll('.ad-hoc-part-item').forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (!checkbox) return;

        const syncItemState = () => {
            item.classList.toggle('is-selected', checkbox.checked);
        };

        checkbox.addEventListener('change', () => {
            syncItemState();
            syncAdHocSelectedParts();
        });

        syncItemState();
    });
}

window.openAdHocModal = function (index, activityType) {
    const record = allMachines[index];
    if (!record) return;

    if (typeof record._runningSeconds === 'undefined') {
        record._runningSeconds = parseRunningHoursToSeconds(record.runningHours);
    }

    const unitEl = document.getElementById('ad-hoc-unit-display');
    const modelEl = document.getElementById('ad-hoc-model-display');
    const serialEl = document.getElementById('ad-hoc-serial-display');
    if (unitEl) unitEl.textContent = record.unit || '\u2014';
    if (modelEl) modelEl.textContent = record.model || '\u2014';
    if (serialEl) serialEl.textContent = record.serialNo || '\u2014';

    const titleEl = document.getElementById('ad-hoc-modal-title');
    if (titleEl) {
        if (activityType === ACTIVITY_TYPES.CANNIBALIZE) {
            titleEl.textContent = 'Cannibalize Parts';
        } else if (activityType === ACTIVITY_TYPES.PARTS_RETURN) {
            titleEl.textContent = 'Return Parts';
        } else {
            titleEl.textContent = 'Pull Out Unit';
        }
    }

    adHocDraft = buildAdHocDraft(record, index, activityType);
    if (adHocDraft) {
        adHocDraft.selectedParts = (activityType === ACTIVITY_TYPES.CANNIBALIZE || activityType === ACTIVITY_TYPES.PARTS_RETURN)
            ? getLatestCannibalizedParts(record)
            : [];
    }

    if (adHocDescriptionInput) adHocDescriptionInput.value = '';
    if (adHocTechniciansInput) adHocTechniciansInput.value = '';
    closeAdHocTechDropdown();

    renderAdHocPartsList(record, activityType, adHocDraft ? adHocDraft.selectedParts : []);

    if (adHocForm) {
        adHocForm.dataset.index = index;
        adHocForm.dataset.activityType = activityType || ACTIVITY_TYPES.CANNIBALIZE;
    }

    if (adHocPopup) adHocPopup.style.display = 'grid';
};

function buildEditDraft(record, index) {
    return {
        index,
        activityType: ACTIVITY_TYPES.PREVENTIVE_MAINTENANCE,
        runningHours: '',
        status: '',
        description: '',
        maintenanceServiceDate: record.maintenanceServiceDate || '',
        partServiceDates: clonePartMap(record.partServiceDates),
        partServiceHours: clonePartMap(record.partServiceHours),
        adjustedPartDates: {}
    };
}

function clearEditDraft() {
    editDraft = null;
}

function syncEditDraftFromInputs() {
    if (!editDraft) return;
    editDraft.runningHours = document.getElementById('edit-runningHours').value;
    editDraft.status = document.getElementById('edit-status').value || '';
    editDraft.description = document.getElementById('edit-description').value || '';
    const activityRadio = document.querySelector('input[name="edit-activity-type"]:checked');
    if (activityRadio) {
        editDraft.activityType = activityRadio.value;
    }
}

async function closeEditModal(discardChanges = false) {
    if (!discardChanges && hasEditDraftChanges()) {
        const shouldDiscard = await showConfirmDialog({
            title: 'Discard Changes?',
            message: 'You have unsaved updates in this form. Discard them?',
            confirmText: 'Discard',
            cancelText: 'Keep Editing',
            tone: 'warning'
        });
        if (!shouldDiscard) return;
    }

    editPopup.style.display = 'none';
    clearEditDraft();
}

function hasEditDraftChanges() {
    if (!editDraft) return false;
    const index = editDraft.index;
    const record = allMachines[index];
    if (!record) return false;

    const liveHours = formatRunningHoursOnly(record._runningSeconds);
    const draftHours = String(editDraft.runningHours || '0');
    const liveStatus = record.status || '';
    const liveDescription = record.description || '';
    const liveMaintenanceServiceDate = record.maintenanceServiceDate || '';

    const liveDates = JSON.stringify(clonePartMap(record.partServiceDates));
    const draftDates = JSON.stringify(clonePartMap(editDraft.partServiceDates));
    const livePartHours = JSON.stringify(clonePartMap(record.partServiceHours));
    const draftPartHours = JSON.stringify(clonePartMap(editDraft.partServiceHours));

    return (
        draftHours !== liveHours ||
        (editDraft.status || '') !== liveStatus ||
        (editDraft.description || '') !== liveDescription ||
        (editDraft.maintenanceServiceDate || '') !== liveMaintenanceServiceDate ||
        draftDates !== liveDates ||
        draftPartHours !== livePartHours
    );
}

function validateEditFormInputs() {
    const runningInput = document.getElementById('edit-runningHours');
    const statusInput = document.getElementById('edit-status');

    const runningRaw = String(runningInput.value || '').trim();
    const runningNum = Number(runningRaw);

    if (runningRaw === '') {
        return { valid: false, message: 'Running Hours is required.' };
    }
    if (!Number.isFinite(runningNum) || Number.isNaN(runningNum)) {
        return { valid: false, message: 'Running Hours must be a valid number.' };
    }
    if (runningNum < 0) {
        return { valid: false, message: 'Running Hours cannot be negative.' };
    }
    if (!Number.isInteger(runningNum)) {
        return { valid: false, message: 'Running Hours must be a whole number.' };
    }
    if (!statusInput.value) {
        return { valid: false, message: 'Status is required.' };
    }

    return { valid: true };
}

window.openEditModal = function (index, activityType) {
    const record = allMachines[index];
    if (!record) return;

    if (typeof record._runningSeconds === 'undefined') {
        record._runningSeconds = parseRunningHoursToSeconds(record.runningHours);
    }

    // Display only (not editable)
    document.getElementById('edit-unit-display').textContent = record.unit || '\u2014';
    document.getElementById('edit-model-display').textContent = record.model || '\u2014';
    document.getElementById('edit-serial-display').textContent = record.serialNo || '\u2014';

    const activityDisplay = document.getElementById('edit-activity-display');
    if (activityDisplay) {
        activityDisplay.textContent = activityType || '\u2014';
    }

    const titleEl = document.getElementById('edit-modal-title');
    if (titleEl) {
        titleEl.textContent = `Update Machine Record — ${activityType || 'Update'}`;
    }

    editDraft = buildEditDraft(record, index);
    if (activityType) {
        editDraft.activityType = activityType;
    }

    // Pre-fill editable fields
    document.getElementById('edit-runningHours').value = editDraft.runningHours;

    const statusSel = document.getElementById('edit-status');
    statusSel.value = editDraft.status;

    document.getElementById('edit-description').value = editDraft.description;

    // Render activity type selector (if container exists)
    renderActivityTypeSelector(editDraft.activityType);

    syncEditDraftFromInputs();

    // Parts checker is fixed to this machine's existing unit/model.
    const { unitKey, modelKey } = getPartsCatalogLocation(record);

    // Show parts panel for scheduled activity types
    updatePartsPanel(record, unitKey, modelKey);

    // Store which record we're editing
    editForm.dataset.index = index;

    editPopup.style.display = 'grid';
};

function renderActivityTypeSelector(selectedType) {
    const container = document.getElementById('edit-activity-type-group');
    if (!container) return;

    const types = [
        { value: ACTIVITY_TYPES.PREVENTIVE_MAINTENANCE, label: 'Preventive Maintenance', scheduled: true },
        { value: ACTIVITY_TYPES.PARTS_REPLACEMENT, label: 'Parts Replacement', scheduled: true },
        { value: ACTIVITY_TYPES.PULL_OUT, label: 'Pull Out', scheduled: false },
        { value: ACTIVITY_TYPES.CANNIBALIZE, label: 'Cannibalize', scheduled: false }
    ];

    container.innerHTML = types.map(t => `
        <label class="activity-type-option${t.scheduled ? '' : ' activity-type-adhoc'}">
            <input type="radio" name="edit-activity-type" value="${escapeHtml(t.value)}"${t.value === selectedType ? ' checked' : ''}>
            <span class="activity-type-label">${escapeHtml(t.label)}</span>
            ${!t.scheduled ? '<span class="activity-type-tag">Ad-hoc</span>' : ''}
        </label>
    `).join('');

    container.querySelectorAll('input[name="edit-activity-type"]').forEach(radio => {
        radio.addEventListener('change', () => {
            syncEditDraftFromInputs();
            const record = allMachines[editDraft ? editDraft.index : -1];
            if (!record) return;
            const { unitKey, modelKey } = getPartsCatalogLocation(record);
            updatePartsPanel(record, unitKey, modelKey);
        });
    });
}

function isScheduledActivity() {
    const type = editDraft ? editDraft.activityType : ACTIVITY_TYPES.PREVENTIVE_MAINTENANCE;
    return SCHEDULED_ACTIVITY_TYPES.has(type);
}

function updatePartsPanel(record, unitKey, modelKey) {
    const partsSection = document.getElementById('edit-parts-section');
    const isScheduled = editDraft && (editDraft.activityType === ACTIVITY_TYPES.PREVENTIVE_MAINTENANCE || editDraft.activityType === ACTIVITY_TYPES.PARTS_REPLACEMENT);

    if (!partsSection) {
        if (isScheduled) renderPartsList(unitKey, modelKey, record._runningSeconds, record, editDraft);
        return;
    }

    if (!isScheduled) {
        partsSection.style.display = 'none';
        return;
    }

    partsSection.style.display = '';
    renderPartsList(unitKey, modelKey, record._runningSeconds, record, editDraft);
}
function renderPartsList(unitKey, modelKey, runningSeconds, record, draftState = null) {
    const partsBody = document.getElementById('parts-tbody');
    if (!unitKey || !modelKey) {
        partsBody.innerHTML = `<tr><td colspan="2" style="text-align:center;color:var(--muted);padding:12px;">No parts data for this machine.</td></tr>`;
        return;
    }
    const parts = (PARTS_CATALOG[unitKey] || {})[modelKey] || [];
    if (!parts.length) {
        partsBody.innerHTML = `<tr><td colspan="2" style="text-align:center;color:var(--muted);padding:12px;">No parts listed for this model.</td></tr>`;
        return;
    }
    const currentHours = (runningSeconds || 0) / 3600;
    const recordIndex = findMachineIndexByRecord(record);
    const statusRecord = draftState
        ? {
            ...record,
            maintenanceServiceDate: draftState.maintenanceServiceDate || '',
            partServiceDates: clonePartMap(draftState.partServiceDates),
            partServiceHours: clonePartMap(draftState.partServiceHours)
        }
        : record;

    const isMaintenance = draftState && draftState.activityType === ACTIVITY_TYPES.PREVENTIVE_MAINTENANCE;
    const isPartsReplacement = draftState && draftState.activityType === ACTIVITY_TYPES.PARTS_REPLACEMENT;

    const maintenanceStatus = getMaintenanceStatus(record.dateInstalled, runningSeconds, statusRecord, 30);
    let maintenanceRow = '';

    if (isMaintenance) {
        let maintenanceBadge = '';
        let maintenanceRowClass = '';

        if (maintenanceStatus.isOverdue) {
            maintenanceBadge = `<button type="button" class="parts-badge parts-badge-overdue parts-badge-action" title="Mark maintenance as completed today" onclick="markMaintenanceAsServiced(${recordIndex})">OVERDUE</button>`;
            maintenanceRowClass = 'parts-row-overdue';
        } else if (maintenanceStatus.isDueSoon) {
            maintenanceBadge = `<button type="button" class="parts-badge parts-badge-soon parts-badge-action" title="Mark maintenance as completed today" onclick="markMaintenanceAsServiced(${recordIndex})">\u26A0 DUE SOON</button>`;
            maintenanceRowClass = 'parts-row-soon';
        } else if (maintenanceStatus.label !== '\u2014') {
            maintenanceBadge = `<button type="button" class="parts-badge parts-badge-ok parts-badge-action" title="Mark maintenance as completed today" onclick="markMaintenanceAsServiced(${recordIndex})">MARK DONE</button>`;
        } else {
            maintenanceBadge = `<span class="parts-badge parts-badge-ok">NO SCHEDULE</span>`;
        }

        const maintenanceLabel = maintenanceStatus.label !== '\u2014'
            ? maintenanceStatus.label
            : 'No schedule set';

        maintenanceRow = `<tr class="${maintenanceRowClass}">
            <td class="parts-cell-part">MAINTENANCE</td>
            <td class="parts-cell-status">
                <div class="parts-status-wrapper">
                    ${maintenanceBadge}
                    <span class="parts-expiry-label">${escapeHtml(maintenanceLabel)}</span>
                </div>
            </td>
        </tr>`;
    }

    let partRows = '';
    if (isPartsReplacement) {
        partRows = parts.map(p => {
            const s = getPartStatus(currentHours, p, statusRecord);
            const encodedPartName = encodeURIComponent(p.name || '');
            const dueDateInputValue = s.expiryDate ? formatDateInputValue(s.expiryDate) : '';

            let statusBadge = '';
            let rowClass = '';
            let displayLabel = s.label;

            const adjusted = draftState && draftState.adjustedPartDates && draftState.adjustedPartDates[p.name];

            if (s.isOverdue) {
                statusBadge = `<button type="button" class="parts-badge parts-badge-overdue parts-badge-action" title="Mark this part as replaced today" onclick="markPartAsServiced(${recordIndex}, '${encodeURIComponent(p.name)}')">OVERDUE</button>`;
                rowClass = 'parts-row-overdue';
                displayLabel = s.label.replace(/^OVERDUE \u2014\s*/, '');
            } else if (s.isDueSoon) {
                statusBadge = `<button type="button" class="parts-badge parts-badge-soon parts-badge-action" title="Mark this part as replaced today" onclick="markPartAsServiced(${recordIndex}, '${encodeURIComponent(p.name)}')">\u26A0 DUE SOON</button>`;
                rowClass = 'parts-row-soon';
                displayLabel = s.label.replace(/^DUE SOON \u2014\s*/, '');
            } else {
                if (adjusted) {
                    statusBadge = `<button type="button" class="parts-badge parts-badge-ok parts-badge-action" title="Adjusted">ADJUSTED</button>`;
                } else {
                    statusBadge = `<button type="button" class="parts-badge parts-badge-ok parts-badge-action" title="Mark this part as replaced today" onclick="markPartAsServiced(${recordIndex}, '${encodeURIComponent(p.name)}')">REPLACE</button>`;
                }
            }

            // Keep the original plain date label layout; only make overdue dates clickable.
            const expiryLabelMarkup = s.isOverdue
                ? `<span class="parts-expiry-label" role="button" onclick="openPartDueDatePicker(${recordIndex}, '${encodedPartName}', '${dueDateInputValue}')">${escapeHtml(displayLabel)}</span>`
                : `<span class="parts-expiry-label">${escapeHtml(displayLabel)}</span>`;

            return `<tr class="${rowClass}">
                <td class="parts-cell-part">${escapeHtml(p.name)}</td>
                <td class="parts-cell-status">
                    <div class="parts-status-wrapper">
                        ${statusBadge}
                        ${expiryLabelMarkup}
                    </div>
                </td>
             </tr>`;
        }).join('');
    }

    const alertRows = `${maintenanceRow}${partRows}`;
    partsBody.innerHTML = alertRows || `<tr><td colspan="2" style="text-align:center;color:var(--muted);padding:14px;font-size:13px;">No due soon or overdue items.</td></tr>`;
}

function formatDateInputValue(dateValue) {
    if (!dateValue) return '';
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function parseDateInputValue(value) {
    const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(year, month - 1, day);
    return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateStorageValue(dateValue) {
    if (!dateValue) return '';
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
}

function findPartDefinition(record, partName) {
    if (!record || !partName) return null;
    const { unitKey, modelKey } = getPartsCatalogLocation(record);
    const parts = unitKey && modelKey ? ((PARTS_CATALOG[unitKey] || {})[modelKey] || []) : [];
    const matchName = String(partName).trim().toLowerCase();
    return parts.find(part => String(part.name || '').trim().toLowerCase() === matchName) || null;
}

function calculateAnchorDateForDueDate(part, dueDate) {
    if (!part || !dueDate) return null;
    const baseDate = new Date(dueDate);
    if (Number.isNaN(baseDate.getTime())) return null;

    if (part.expiryMonths) {
        return addMonths(baseDate, -Number(part.expiryMonths));
    }

    if (part.expiryHours) {
        const days = Math.round(Number(part.expiryHours) / 24);
        const anchor = new Date(baseDate);
        anchor.setDate(anchor.getDate() - days);
        return anchor;
    }

    return null;
}

window.openPartDueDatePicker = function (index, encodedPartName, defaultValue) {
    const record = allMachines[index];
    if (!record || !editDraft || editDraft.index !== index) return;

    const existing = document.getElementById('partDueDateOverlay');
    if (existing) existing.remove();

    const initialDate = defaultValue ? (parseDateInputValue(defaultValue) || new Date()) : new Date();
    const initialValue = defaultValue || formatDateInputValue(initialDate);

    const partLabel = escapeHtml(decodeURIComponent(encodedPartName || ''));

    const overlay = document.createElement('div');
    overlay.id = 'partDueDateOverlay';
    overlay.className = 'popup-overlay';
    overlay.style.cssText = 'display:grid; z-index:600;';

    overlay.innerHTML = `
        <div class="confirm-card" role="dialog" aria-modal="true" aria-labelledby="pddTitle">
            <h3 id="pddTitle" style="margin-bottom:4px;">Adjust Part Due Date</h3>
            <p style="font-size:13px; color:var(--muted); margin-bottom:16px;">
                Choose the next due date for <strong style="color:var(--text);">${partLabel}</strong>.
            </p>

            <div style="display:grid;gap:8px;">
                <label class="edit-label" for="pddDateInput" style="margin:0;">Date</label>
                <input class="edit-input" type="date" id="pddDateInput" value="${escapeHtml(initialValue)}" required />
            </div>

            <div class="confirm-actions" style="margin-top:14px;">
                <button type="button" class="btn confirm-btn-cancel" id="pddCancel">Cancel</button>
                <button type="button" class="btn confirm-btn-ok" id="pddApply">Apply Date</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const dateInput = overlay.querySelector('#pddDateInput');

    // ─── Cleanup & apply ─────────────────────────────────────────────────────

    const cleanup = () => {
        const node = document.getElementById('partDueDateOverlay');
        if (node) node.remove();
    };

    overlay.querySelector('#pddCancel').addEventListener('click', cleanup);

    overlay.querySelector('#pddApply').addEventListener('click', async () => {
        if (!dateInput.value) {
            showToast('Please select a valid date.', 'warning');
            return;
        }
        cleanup();
        await applyPartDueDate(index, encodedPartName, dateInput.value);
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cleanup();
    });
};

window.applyPartDueDate = async function (index, encodedPartName, dueDateValue) {
    const record = allMachines[index];
    if (!record || !editDraft || editDraft.index !== index) return;

    const partName = decodeURIComponent(encodedPartName || '');
    if (!partName) return;

    const dueDate = parseDateInputValue(dueDateValue);
    if (!dueDate) {
        showToast('Please select a valid date.', 'warning');
        return;
    }

    const partDef = findPartDefinition(record, partName);
    if (!partDef) {
        showToast('Part not found for this model.', 'warning');
        return;
    }

    const confirmApply = await showConfirmDialog({
        title: 'Adjust Part Due Date',
        message: `Set the next due date for "${partName}" to ${formatDateDisplay(dueDateValue)}?`,
        confirmText: 'Apply Date',
        cancelText: 'Cancel',
        tone: 'warning'
    });
    if (!confirmApply) return;

    const anchorDate = calculateAnchorDateForDueDate(partDef, dueDate);
    if (!anchorDate) {
        showToast('Unable to calculate new due date for this part.', 'warning');
        return;
    }

    syncEditDraftFromInputs();

    if (!editDraft.partServiceDates || typeof editDraft.partServiceDates !== 'object') {
        editDraft.partServiceDates = {};
    }
    if (!editDraft.partServiceHours || typeof editDraft.partServiceHours !== 'object') {
        editDraft.partServiceHours = {};
    }

    editDraft.partServiceDates[partName] = formatDateStorageValue(anchorDate);

    const runningValue = Number(editDraft.runningHours);
    const currentHours = Number.isFinite(runningValue)
        ? runningValue
        : ((record._runningSeconds || 0) / 3600);

    editDraft.partServiceHours[partName] = currentHours;

    if (!editDraft.adjustedPartDates || typeof editDraft.adjustedPartDates !== 'object') {
        editDraft.adjustedPartDates = {};
    }
    editDraft.adjustedPartDates[partName] = true;

    const { unitKey, modelKey } = getPartsCatalogLocation(record);
    updatePartsPanel(record, unitKey, modelKey);
};

window.markMaintenanceAsServiced = async function (index) {
    const record = allMachines[index];
    if (!record || !editDraft || editDraft.index !== index) return;

    const shouldApply = await showConfirmDialog({
        title: 'Confirm Maintenance Completion',
        message: 'Mark preventive maintenance as completed today?',
        confirmText: 'Apply Update',
        cancelText: 'Cancel',
        tone: 'warning'
    });
    if (!shouldApply) return;

    const todayStr = getTodayDateString();
    editDraft.maintenanceServiceDate = todayStr;

    const { unitKey, modelKey } = getPartsCatalogLocation(record);

    updatePartsPanel(record, unitKey, modelKey);
};

window.markPartAsServiced = async function (index, encodedPartName) {
    const record = allMachines[index];
    if (!record || !editDraft || editDraft.index !== index) return;

    const partName = decodeURIComponent(encodedPartName || '');
    if (!partName) return;

    const shouldApply = await showConfirmDialog({
        title: 'Confirm Part Replacement',
        message: `Mark "${partName}" as replaced today?`,
        confirmText: 'Apply Update',
        cancelText: 'Cancel',
        tone: 'warning'
    });
    if (!shouldApply) return;

    if (!editDraft.partServiceDates || typeof editDraft.partServiceDates !== 'object') {
        editDraft.partServiceDates = {};
    }
    if (!editDraft.partServiceHours || typeof editDraft.partServiceHours !== 'object') {
        editDraft.partServiceHours = {};
    }

    // Use current date as the new anchor date for this part.
    const todayStr = getTodayDateString();
    syncEditDraftFromInputs();

    editDraft.partServiceDates[partName] = todayStr;
    editDraft.partServiceHours[partName] = Number(editDraft.runningHours) || ((record._runningSeconds || 0) / 3600);

    if (editDraft.adjustedPartDates && editDraft.adjustedPartDates[partName]) {
        delete editDraft.adjustedPartDates[partName];
    }

    const { unitKey, modelKey } = getPartsCatalogLocation(record);

    updatePartsPanel(record, unitKey, modelKey);
};

closeEditPopup.addEventListener('click', async () => {
    await closeEditModal();
});

if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', async () => {
        await closeEditModal();
    });
}

if (confirmOkBtn) {
    confirmOkBtn.addEventListener('click', () => {
        resolveConfirmDialog(true);
    });
}

if (confirmCancelBtn) {
    confirmCancelBtn.addEventListener('click', () => {
        resolveConfirmDialog(false);
    });
}

if (confirmOverlay) {
    confirmOverlay.addEventListener('click', (e) => {
        if (e.target === confirmOverlay) {
            resolveConfirmDialog(false);
        }
    });
}

document.addEventListener('keydown', (e) => {
    if (!confirmOverlay || confirmOverlay.style.display === 'none' || !activeConfirmResolver) return;
    if (e.key === 'Escape') {
        e.preventDefault();
        resolveConfirmDialog(false);
    }
    if (e.key === 'Enter') {
        e.preventDefault();
        resolveConfirmDialog(true);
    }
});

document.getElementById('edit-runningHours').addEventListener('input', syncEditDraftFromInputs);
document.getElementById('edit-status').addEventListener('change', syncEditDraftFromInputs);
document.getElementById('edit-description').addEventListener('input', syncEditDraftFromInputs);

editPopup.addEventListener('click', (e) => {
    if (e.target === editPopup) {
        closeEditModal();
    }
});

editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    syncEditDraftFromInputs();

    const index = parseInt(editForm.dataset.index, 10);
    const record = allMachines[index];
    if (!record) return;

    const validation = validateEditFormInputs();
    if (!validation.valid) {
        showToast(validation.message, 'warning');
        return;
    }

    if (!hasEditDraftChanges()) {
        showToast('No changes to save.', 'info');
        return;
    }

    const pendingMachineUpdate = buildPendingMachineUpdate(record, index);
    if (!pendingMachineUpdate) {
        showToast('Unable to prepare the next step.', 'warning');
        return;
    }

    window.pendingMachineUpdate = pendingMachineUpdate;
    if (typeof openReportPopup === 'function') {
        openReportPopup(record, index, null);
    }
});

if (closeAdHocPopup) {
    closeAdHocPopup.addEventListener('click', closeAdHocModal);
}

if (cancelAdHocBtn) {
    cancelAdHocBtn.addEventListener('click', closeAdHocModal);
}

if (adHocPopup) {
    adHocPopup.addEventListener('click', (e) => {
        if (e.target === adHocPopup) closeAdHocModal();
    });
}

if (adHocTechniciansInput) {
    adHocTechniciansInput.addEventListener('input', () => {
        adHocTechFocusedIndex = -1;
        renderAdHocTechDropdown();
    });

    adHocTechniciansInput.addEventListener('focus', () => {
        renderAdHocTechDropdown();
    });

    adHocTechniciansInput.addEventListener('keydown', (event) => {
        if (!adHocTechDropdown || !adHocTechDropdown.classList.contains('open')) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                renderAdHocTechDropdown();
            }
            return;
        }

        const items = Array.from(adHocTechDropdown.querySelectorAll('.report-tech-item'));
        if (!items.length) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            adHocTechFocusedIndex = Math.min(adHocTechFocusedIndex + 1, items.length - 1);
            renderAdHocTechDropdown();
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            adHocTechFocusedIndex = Math.max(adHocTechFocusedIndex - 1, 0);
            renderAdHocTechDropdown();
            return;
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            if (adHocTechFocusedIndex >= 0 && items[adHocTechFocusedIndex]) {
                const selected = items[adHocTechFocusedIndex].dataset.name || '';
                insertAdHocTechnician(selected);
            }
            return;
        }

        if (event.key === 'Escape') {
            closeAdHocTechDropdown();
        }
    });
}

document.addEventListener('click', (event) => {
    if (!adHocTechniciansInput || !adHocTechDropdown) return;
    if (!event.target.closest('#adHocForm .report-tech-wrap')) {
        closeAdHocTechDropdown();
    }
});

if (adHocForm) {
    adHocForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const index = parseInt(adHocForm.dataset.index, 10);
        const record = allMachines[index];
        if (!record) return;

        const activityType = adHocForm.dataset.activityType || ACTIVITY_TYPES.CANNIBALIZE;
        const description = adHocDescriptionInput ? adHocDescriptionInput.value.trim() : '';
        const technicianInput = adHocTechniciansInput ? adHocTechniciansInput.value : '';

        let pickedTechnicians = [];
        if (technicianInput.trim()) {
            const technicianParse = parseTechnicianInput(technicianInput);
            if (technicianParse.invalid.length > 0) {
                showToast('Technician names must be selected from active user suggestions.', 'warning');
                return;
            }
            pickedTechnicians = technicianParse.picked;
        }

        const partsList = document.getElementById('ad-hoc-parts-list');
        syncAdHocSelectedParts();
        const selectedParts = adHocDraft && Array.isArray(adHocDraft.selectedParts)
            ? adHocDraft.selectedParts.slice()
            : (partsList
                ? Array.from(partsList.querySelectorAll('input[type="checkbox"]:checked'))
                    .map(input => decodeURIComponent(input.dataset.name || ''))
                    .filter(Boolean)
                : []);

        if (!Array.isArray(record.updates)) record.updates = [];

        let finalActivityType = activityType;
        if (activityType === ACTIVITY_TYPES.CANNIBALIZE) {
            const previousParts = getLatestCannibalizedParts(record);
            const returnedSome = previousParts.some(p => !selectedParts.includes(p));
            if (returnedSome) {
                finalActivityType = ACTIVITY_TYPES.PARTS_RETURN;
            }
        }

        const todayStr = getTodayDateString();
        const runningHours = Number(record.runningHours) || 0;
        const status = record.status || '';
        const nextDescription = record.description || '';
        const updateDescription = description;

        const updateEntry = {
            date: todayStr,
            activityType: finalActivityType,
            submittedBy: typeof CURRENT_USER_FULLNAME !== 'undefined' ? CURRENT_USER_FULLNAME : 'Unknown User',
            status,
            runningHours,
            description: updateDescription,
            maintenanceUpdated: false,
            maintenanceServiceDate: String(record.maintenanceServiceDate || ''),
            partsUpdated: (finalActivityType === ACTIVITY_TYPES.CANNIBALIZE || finalActivityType === ACTIVITY_TYPES.PARTS_RETURN) ? selectedParts : [],
            partServiceDates: clonePartMap(record.partServiceDates),
            partServiceHours: clonePartMap(record.partServiceHours),
            technicians: pickedTechnicians
        };

        record.updates.push(updateEntry);
        record.description = nextDescription;

        try {
            const response = await fetch(`/client/${encodeURIComponent(CLIENT_ID)}/machines/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    serialNo: record.serialNo,
                    model: record.model,
                    dateInstalled: record.dateInstalled,
                    runningHours,
                    status,
                    description: nextDescription,
                    activityType: finalActivityType,
                    maintenanceServiceDate: String(record.maintenanceServiceDate || ''),
                    partServiceDates: clonePartMap(record.partServiceDates),
                    partServiceHours: clonePartMap(record.partServiceHours),
                    updates: record.updates
                })
            });

            const payload = await response.json();
            if (!response.ok || !payload.ok) {
                throw new Error(payload.error || 'Failed to save updates.');
            }

            Object.assign(record, payload.machine);
            record._runningSeconds = (Number(payload.machine.runningHours) || 0) * 3600;

            allMachines = orderMachinesNewestFirst(allMachines);
            filteredMachines = orderMachinesNewestFirst(filteredMachines);
            currentPage = 1;
            renderTable(filteredMachines);

            if (detailPopup.style.display !== 'none' && currentDetailIndex === index) {
                showDetails(index);
            }

            closeAdHocModal();
            showToast('Record updated successfully.', 'success');
        } catch (error) {
            showToast(error.message || 'Failed to save updates.', 'warning');
        }
    });
}

function showToast(message, type = 'success') {
    let toast = document.getElementById('update-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'update-toast';
        toast.style.cssText = `
            position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
            background: #1e7c3a; color: #fff; padding: 12px 24px;
            border-radius: 8px; font-size: 14px; font-weight: 600;
            box-shadow: 0 4px 16px rgba(0,0,0,0.18); z-index: 9999;
            transition: opacity 0.4s;
        `;
        document.body.appendChild(toast);
    }

    if (type === 'warning') {
        toast.style.background = '#b45309';
    } else if (type === 'info') {
        toast.style.background = '#2a6499';
    } else {
        toast.style.background = '#1e7c3a';
    }

    toast.textContent = message;
    toast.style.opacity = '1';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => { toast.style.opacity = '0'; }, 2800);
}