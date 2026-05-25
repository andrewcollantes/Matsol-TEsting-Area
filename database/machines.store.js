const { getDb, persistDb } = require('./memory');

function cloneMap(value) {
  return value && typeof value === 'object' ? { ...value } : {};
}

function cloneReport(report) {
  if (!report || typeof report !== 'object') {
    return null;
  }

  return {
    ...report,
    technicians: Array.isArray(report.technicians) ? report.technicians.map(name => String(name || '')) : []
  };
}

function cloneUpdate(update) {
  if (!update || typeof update !== 'object') {
    return {};
  }

  return {
    ...update,
    partsUpdated: Array.isArray(update.partsUpdated) ? update.partsUpdated.map(name => String(name || '')) : [],
    partServiceDates: cloneMap(update.partServiceDates),
    partServiceHours: cloneMap(update.partServiceHours),
    report: cloneReport(update.report)
  };
}

function cloneMachine(machine) {
  return {
    ...machine,
    technicians: Array.isArray(machine.technicians) ? machine.technicians.map(name => String(name || '')) : [],
    partServiceDates: cloneMap(machine.partServiceDates),
    partServiceHours: cloneMap(machine.partServiceHours),
    initialPartServiceDates: cloneMap(machine.initialPartServiceDates),
    initialPartServiceHours: cloneMap(machine.initialPartServiceHours),
    updates: Array.isArray(machine.updates) ? machine.updates.map(cloneUpdate) : [],
    reports: Array.isArray(machine.reports) ? machine.reports.map(cloneReport).filter(Boolean) : []
  };
}

async function listMachinesByClientId(clientId) {
  const key = String(clientId || '').trim().toLowerCase();
  const db = await getDb();
  return db.machines
    .filter(machine => String(machine.clientId || '').trim().toLowerCase() === key)
    .slice()
    .reverse()
    .map(cloneMachine);
}

async function listAllMachines() {
  const db = await getDb();
  return db.machines.slice().map(cloneMachine);
}

async function addMachine(machine) {
  const db = await getDb();
  const clientIdKey = String(machine.clientId || '').trim().toLowerCase();
  const identity = {
    clientId: clientIdKey,
    clientName: machine.clientName ? String(machine.clientName) : null,
    location: machine.location ? String(machine.location) : null,
    unit: machine.unit ? String(machine.unit) : null,
    model: String(machine.model || '').trim(),
    serialNo: String(machine.serialNo || '').trim(),
    dateInstalled: String(machine.dateInstalled || '').trim(),
    runningHours: Number.isFinite(Number(machine.runningHours)) ? Number(machine.runningHours) : 0,
    status: machine.status ? String(machine.status) : null,
    description: machine.description ? String(machine.description) : '',
    submittedBy: machine.submittedBy ? String(machine.submittedBy) : null,
    technicians: Array.isArray(machine.technicians) ? machine.technicians.map(name => String(name || '')) : [],
    maintenanceServiceDate: machine.maintenanceServiceDate ? String(machine.maintenanceServiceDate) : '',
    partServiceDates: cloneMap(machine.partServiceDates),
    partServiceHours: cloneMap(machine.partServiceHours),
    updates: Array.isArray(machine.updates) ? machine.updates.map(cloneUpdate) : [],
    reports: Array.isArray(machine.reports) ? machine.reports.map(cloneReport).filter(Boolean) : [],
    initialRunningHours: Number.isFinite(Number(machine.runningHours)) ? Number(machine.runningHours) : 0,
    initialStatus: machine.status ? String(machine.status) : null,
    initialDescription: machine.description ? String(machine.description) : '',
    initialMaintenanceServiceDate: machine.maintenanceServiceDate ? String(machine.maintenanceServiceDate) : '',
    initialPartServiceDates: cloneMap(machine.partServiceDates),
    initialPartServiceHours: cloneMap(machine.partServiceHours)
  };

  db.machines.push(identity);
  await persistDb();
}

async function updateMachine(key, updates) {
  const db = await getDb();
  const target = db.machines.find(machine => (
    String(machine.clientId || '').trim().toLowerCase() === String(key.clientId || '').trim().toLowerCase() &&
    String(machine.serialNo || '').trim().toLowerCase() === String(key.serialNo || '').trim().toLowerCase() &&
    String(machine.model || '').trim().toLowerCase() === String(key.model || '').trim().toLowerCase() &&
    String(machine.dateInstalled || '').trim() === String(key.dateInstalled || '').trim()
  ));

  if (!target) {
    return null;
  }

  target.runningHours = Number.isFinite(Number(updates.runningHours)) ? Number(updates.runningHours) : target.runningHours;
  target.status = updates.status !== undefined ? String(updates.status) : target.status;
  target.description = updates.description !== undefined ? String(updates.description || '') : target.description;
  target.maintenanceServiceDate = updates.maintenanceServiceDate !== undefined ? String(updates.maintenanceServiceDate || '') : target.maintenanceServiceDate;
  target.partServiceDates = updates.partServiceDates && typeof updates.partServiceDates === 'object'
    ? cloneMap(updates.partServiceDates)
    : target.partServiceDates;
  target.partServiceHours = updates.partServiceHours && typeof updates.partServiceHours === 'object'
    ? cloneMap(updates.partServiceHours)
    : target.partServiceHours;
  target.updates = Array.isArray(updates.updates)
    ? updates.updates.map(cloneUpdate)
    : target.updates;

  const report = cloneReport(updates.report);
  if (report) {
    target.reports = Array.isArray(target.reports) ? target.reports.slice() : [];
    const reportIndex = Number(report.updateIndex);
    const hasRequestedIndex = Number.isInteger(reportIndex) && reportIndex >= 0 && reportIndex < target.updates.length;
    const updateTarget = hasRequestedIndex
      ? target.updates[reportIndex]
      : target.updates[target.updates.length - 1];

    if (updateTarget) {
      updateTarget.submittedBy = String(report.submittedBy || updateTarget.submittedBy || 'Unknown User');
      updateTarget.report = cloneReport(report);
    }

    const existingReportIndex = target.reports.findIndex(existing => (
      Number(existing && existing.updateIndex) === Number(report.updateIndex) &&
      String(existing && existing.date || '').trim() === String(report.date || '').trim()
    ));

    if (existingReportIndex >= 0) {
      target.reports[existingReportIndex] = report;
    } else {
      target.reports.push(report);
    }
  }

  await persistDb();

  return cloneMachine(target);
}

async function appendMachineReport(key, report) {
  const db = await getDb();
  const target = db.machines.find(machine => (
    String(machine.clientId || '').trim().toLowerCase() === String(key.clientId || '').trim().toLowerCase() &&
    String(machine.serialNo || '').trim().toLowerCase() === String(key.serialNo || '').trim().toLowerCase() &&
    String(machine.model || '').trim().toLowerCase() === String(key.model || '').trim().toLowerCase() &&
    String(machine.dateInstalled || '').trim() === String(key.dateInstalled || '').trim()
  ));

  if (!target) {
    return null;
  }

  const reports = Array.isArray(target.reports) ? target.reports.slice() : [];
  const updates = Array.isArray(target.updates) ? target.updates.slice() : [];
  reports.push(cloneReport(report));

  // Keep Machine History aligned with the saved report team and tie report to update row.
  if (report && report.submittedBy && updates.length > 0) {
    const requestedIndex = Number(report.updateIndex);
    const hasRequestedIndex = Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < updates.length;
    const updateTarget = hasRequestedIndex
      ? updates[requestedIndex]
      : updates[updates.length - 1];

    updateTarget.submittedBy = String(report.submittedBy);
    updateTarget.report = cloneReport(report);
  }

  target.reports = reports;
  target.updates = updates;

  await persistDb();

  return cloneMachine(target);
}

module.exports = {
  listAllMachines,
  listMachinesByClientId,
  addMachine,
  updateMachine,
  appendMachineReport
};
