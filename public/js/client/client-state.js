// Activity type constants
// Only PREVENTIVE_MAINTENANCE and PARTS_REPLACEMENT are schedule-based
// and generate notifications / warning indicators.
// PULL_OUT and CANNIBALIZE are ad-hoc activity records only.
const ACTIVITY_TYPES = {
    PREVENTIVE_MAINTENANCE: 'Preventive Maintenance',
    PARTS_REPLACEMENT: 'Parts Replacement',
    PULL_OUT: 'Pull Out',
    CANNIBALIZE: 'Cannibalize',
    PARTS_RETURN: 'Parts Return'
};

const SCHEDULED_ACTIVITY_TYPES = new Set([
    ACTIVITY_TYPES.PREVENTIVE_MAINTENANCE,
    ACTIVITY_TYPES.PARTS_REPLACEMENT
]);

var allMachines = [];
var filteredMachines = [];
var currentDetailIndex = null;
var currentPage = 1;
const PAGE_SIZE = 10;
const WARNING_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
         fill="#e67e22" class="warning-icon" aria-label="Maintenance due soon">
    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
</svg>`;