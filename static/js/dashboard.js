const numberFmt = new Intl.NumberFormat('pt-BR');
const charts = {};
const PCS = new Set(['HASSEL', 'TSUBASA', 'EVE', 'MUSA']);
const AVATAR_MAP = {
    HASSEL: './static/avatars/HASSEL.png',
    TSUBASA: './static/avatars/TSUBASA.png',
    EVE: './static/avatars/EVE.png',
    MUSA: './static/avatars/MUSA.png',
    PAPILO: './static/avatars/PAPILO.png',
    JESSICA: './static/avatars/JESSICA.png',
    FRAN: './static/avatars/FRAN.png',
    FUZE: './static/avatars/FUZE.png',
    KIKI: './static/avatars/KIKI.png'
};

const DISPLAY_METRICS = {
    DANO_RECEBIDO: 'Dano recebido',
    DANO_APLICADO: 'Dano aplicado',
    HEAT_APLICADO: 'Heat aplicado',
    ABATES: 'Abates',
    ESTRUTURAS_DESTRUIDAS: 'Estruturas destruídas',
    REATORES_DESTRUIDOS: 'Reatores destruídos',
    NPC_MAIS_USADOS: 'NPC mais usados',
    SCANS: 'Scans',
    BEIJOS: 'Beijos',
    FOI_PRA_CHAPA: 'Foi pra chapa'
};

const CHARACTER_COLOR_ORDER = ['HASSEL', 'TSUBASA', 'EVE', 'MUSA', 'PAPILO', 'JESSICA', 'FRAN', 'FUZE', 'KIKI'];

function getCharacterColor(name, palette) {
    const normalized = String(name || '').toUpperCase();
    const idx = CHARACTER_COLOR_ORDER.indexOf(normalized);
    if (idx >= 0) return palette.colors[idx % palette.colors.length];
    let hash = 0;
    for (let i = 0; i < normalized.length; i += 1) hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
    return palette.colors[Math.abs(hash) % palette.colors.length];
}

function updateShareChartTitle(metricLabel) {
    const title = document.getElementById('shareChartTitle');
    if (!title) return;
    title.textContent = metricLabel ? `Distribuição de ${metricLabel}` : 'Distribuição do indicador';
}

function getThemePalette(isRomantic = false) {
    return isRomantic
        ? {
            axis: '#f5cade',
            split: 'rgba(255, 210, 227, 0.12)',
            text: '#fff4fa',
            colors: ['#ff9fbe', '#ffb7d0', '#ffcfe0', '#f99bb2', '#ff8eb0', '#ffd6e8', '#f3abc6', '#fbdce7'],
            border: '#180813',
            area: 'rgba(255, 159, 190, 0.22)'
        }
        : {
            axis: '#b7c2eb',
            split: 'rgba(255,255,255,0.08)',
            text: '#edf2ff',
            colors: ['#7dd3fc', '#60a5fa', '#818cf8', '#34d399', '#f59e0b', '#f472b6', '#c084fc', '#fb7185'],
            border: '#0b1020',
            area: 'rgba(125, 211, 252, 0.18)'
        };
}

let allStats = [];

function initChart(id) {
    const element = document.getElementById(id);
    if (charts[id]) return charts[id];
    const chart = echarts.init(element);
    charts[id] = chart;
    return chart;
}

function withGroup(record) {
    return {
        ...record,
        character_group: PCS.has(String(record.entity).toUpperCase()) ? 'PCs' : 'NPCs'
    };
}

function uniqueBy(arr, keyFn) {
    const seen = new Set();
    const out = [];
    for (const item of arr) {
        const key = keyFn(item);
        if (!seen.has(key)) {
            seen.add(key);
            out.push(item);
        }
    }
    return out;
}

function sortMissions(records) {
    return uniqueBy(records, r => `${r.snapshot_order}|${r.mission_label}`)
        .sort((a, b) => a.snapshot_order - b.snapshot_order)
        .map(r => ({ snapshot_order: r.snapshot_order, mission_label: r.mission_label }));
}

function getFilters() {
    return {
        mission: document.getElementById('missionFilter').value,
        metric: document.getElementById('metricFilter').value,
        group: document.getElementById('groupFilter').value,
        character: document.getElementById('characterFilter').value,
    };
}

function populateSelect(selectId, values, selectedValue, placeholderLabel, isObjectList = false) {
    const select = document.getElementById(selectId);
    const currentValue = selectedValue ?? select.value;
    select.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = placeholderLabel;
    select.appendChild(defaultOption);
    values.forEach(item => {
        const option = document.createElement('option');
        option.value = isObjectList ? item.value : item;
        option.textContent = isObjectList ? item.label : item;
        if (option.value === currentValue) option.selected = true;
        select.appendChild(option);
    });
}

function syncFilterOptions(filterOptions, activeFilters) {
    populateSelect('missionFilter', filterOptions.missions, activeFilters.mission, 'Última missão');
    populateSelect('metricFilter', filterOptions.metrics, activeFilters.metric, 'Indicador padrão', true);
    populateSelect('groupFilter', filterOptions.groups, activeFilters.group, 'Todos');
    populateSelect('characterFilter', filterOptions.characters, activeFilters.character, 'Todos');
}

function renderAvatarStrip(characters, activeCharacter) {
    const strip = document.getElementById('avatarStrip');
    strip.innerHTML = '';
    characters.forEach(name => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `avatar-card${name === activeCharacter ? ' active' : ''}`;

        const frame = document.createElement('div');
        frame.className = 'avatar-frame';
        const img = document.createElement('img');
        img.src = AVATAR_MAP[name] || '';
        img.alt = `Avatar de ${name}`;
        frame.appendChild(img);

        const title = document.createElement('span');
        title.className = 'avatar-name';
        title.textContent = name;

        const tag = document.createElement('span');
        tag.className = 'avatar-tag';
        tag.textContent = PCS.has(name) ? 'PC' : 'NPC';

        button.append(frame, title, tag);
        button.addEventListener('click', () => {
            document.getElementById('characterFilter').value = name;
            renderDashboard();
        });
        strip.appendChild(button);
    });
}

function setRomanticTheme(isActive) {
    document.body.classList.toggle('romantic-theme', Boolean(isActive));
}

function metricPhrase(metricKey) {
    if (metricKey === 'FOI_PRA_CHAPA') return 'Foi pra chapa';
    return DISPLAY_METRICS[metricKey] || metricKey;
}

function getMetricValueForCharacter(snapshotRows, metricKey, character) {
    const row = snapshotRows.find(r => r.metric === metricKey && r.entity === character && r.metric_available);
    return row ? Number(row.cumulative_total || 0) : 0;
}

function formatLeaderMeta(value, metricKey, emptyLabel, isNpc) {
    if (!metricKey || metricKey === 'FOI_PRA_CHAPA') {
        return isNpc ? 'bolas' : 'Caram';
    }
    if (!Number.isFinite(value)) return emptyLabel;
    return `${numberFmt.format(value)} de ${metricPhrase(metricKey)}`;
}

function setLeaderCard(prefix, leader, metricKey, isNpc = false) {
    const avatar = document.getElementById(`${prefix}Avatar`);
    const name = document.getElementById(`${prefix}Name`);
    const valueText = document.getElementById(`${prefix}ValueText`);

    name.textContent = leader?.name || '--';
    valueText.textContent = leader?.name
        ? formatLeaderMeta(leader.value, metricKey, '--', isNpc)
        : '--';
    avatar.src = leader?.name ? (AVATAR_MAP[leader.name] || '') : '';
    avatar.alt = leader?.name ? `Avatar de ${leader.name}` : 'Sem avatar';
}

function setTotalCard(kpis) {
    const avatarFrame = document.getElementById('totalAccumulatedAvatarFrame');
    const avatar = document.getElementById('totalAccumulatedAvatar');
    const name = document.getElementById('totalAccumulatedName');
    const valueText = document.getElementById('totalAccumulatedValueText');
    const focusName = kpis.total_focus_name || 'Visão geral';
    const hasCharacterFocus = Boolean(kpis.selected_character);

    name.textContent = focusName;
    avatarFrame.classList.toggle('hidden', !hasCharacterFocus);
    avatar.src = hasCharacterFocus && kpis.total_focus_avatar ? (AVATAR_MAP[kpis.total_focus_avatar] || '') : '';
    avatar.alt = hasCharacterFocus && kpis.total_focus_avatar ? `Avatar de ${kpis.total_focus_avatar}` : 'Sem avatar';

    if (kpis.metric_key === 'FOI_PRA_CHAPA') {
        valueText.textContent = `${kpis.selected_metric}${kpis.selected_character ? ` • ${kpis.selected_character}` : ''}`;
        return;
    }

    const valuePart = Number.isFinite(kpis.total_accumulated) ? numberFmt.format(kpis.total_accumulated) : '--';
    const characterPart = kpis.selected_character ? ` • ${kpis.selected_character}` : '';
    valueText.textContent = `${valuePart} de ${kpis.selected_metric}${characterPart}`;
}

function setCharacterMetricKpis(extraKpis, selectedCharacter) {
    const cards = {
        damageApplied: ['metricKpiDamageApplied', 'metricKpiDamageAppliedValue'],
        damageReceived: ['metricKpiDamageReceived', 'metricKpiDamageReceivedValue'],
        heatApplied: ['metricKpiHeatApplied', 'metricKpiHeatAppliedValue'],
        kills: ['metricKpiKills', 'metricKpiKillsValue'],
        scans: ['metricKpiScans', 'metricKpiScansValue'],
    };

    const show = Boolean(selectedCharacter);
    Object.entries(cards).forEach(([key, [cardId, valueId]]) => {
        const card = document.getElementById(cardId);
        const valueEl = document.getElementById(valueId);
        card.classList.toggle('hidden', !show);
        valueEl.textContent = show && Number.isFinite(extraKpis?.[key]) ? numberFmt.format(extraKpis[key]) : '--';
    });
}

function setKpis(kpis) {
    setTotalCard(kpis);
    setLeaderCard('leaderPc', kpis.pc_leader, kpis.metric_key, false);
    setLeaderCard('leaderNpc', kpis.npc_leader, kpis.metric_key, true);
    setCharacterMetricKpis(kpis.character_metric_kpis, kpis.selected_character);
    document.getElementById('lastUpdated').textContent = `Missão: ${kpis.last_updated}`;
    document.getElementById('heroMission').textContent = kpis.selected_mission;
    document.getElementById('heroMetric').textContent = `${kpis.selected_metric} • ${kpis.selected_group}`;
}

function updateRevenuePill(activeFilters, kpis) {
    const parts = [kpis.selected_metric, activeFilters.group || 'Todos'];
    if (activeFilters.character) parts.push(activeFilters.character);
    else parts.push('Visão geral');
    document.getElementById('revenuePill').textContent = parts.join(' • ');
}

function buildDashboardData(sourceRecords, filters) {
    const df = sourceRecords.map(withGroup);
    const missions = sortMissions(df);
    const metrics = Object.keys(DISPLAY_METRICS).filter(m => df.some(r => r.metric === m));

    const selectedMission = filters.mission || (missions.length ? missions[missions.length - 1].mission_label : '');
    const selectedMetric = filters.metric || 'DANO_APLICADO';
    const selectedGroup = ['PCs', 'NPCs'].includes(filters.group) ? filters.group : '';

    const fullSnapshotDf = df.filter(r => r.mission_label === selectedMission);
    const fullMetricSnapshotDf = fullSnapshotDf.filter(r => r.metric === selectedMetric && r.metric_available);

    const pcRankingDf = fullMetricSnapshotDf
        .filter(r => PCS.has(String(r.entity).toUpperCase()))
        .sort((a, b) => (Number(b.cumulative_total || 0) - Number(a.cumulative_total || 0)) || String(a.entity).localeCompare(String(b.entity), 'pt-BR'));
    let npcRankingDf = fullMetricSnapshotDf
        .filter(r => !PCS.has(String(r.entity).toUpperCase()))
        .sort((a, b) => (Number(b.cumulative_total || 0) - Number(a.cumulative_total || 0)) || String(a.entity).localeCompare(String(b.entity), 'pt-BR'));

    if (selectedMetric === 'FOI_PRA_CHAPA') {
        const kikiRow = npcRankingDf.find(r => String(r.entity).toUpperCase() === 'KIKI')
            || fullMetricSnapshotDf.find(r => String(r.entity).toUpperCase() === 'KIKI');
        npcRankingDf = kikiRow
            ? [kikiRow, ...npcRankingDf.filter(r => String(r.entity).toUpperCase() !== 'KIKI')]
            : [{ entity: 'KIKI', cumulative_total: 0 }, ...npcRankingDf];
    }

    const groupDf = selectedGroup ? df.filter(r => r.character_group === selectedGroup) : df.slice();
    const availableCharacters = [...new Set(groupDf.map(r => r.entity).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const selectedCharacter = availableCharacters.includes(filters.character) ? filters.character : '';
    const romanticMode = selectedMetric === 'FOI_PRA_CHAPA';
    const avatarCharacters = romanticMode ? ['KIKI', 'TSUBASA'] : availableCharacters;

    const snapshotDf = groupDf.filter(r => r.mission_label === selectedMission);
    const metricSnapshotDf = snapshotDf.filter(r => r.metric === selectedMetric && r.metric_available);

    let trendDf = groupDf.filter(r => r.metric === selectedMetric && r.metric_available);
    if (selectedCharacter) trendDf = trendDf.filter(r => r.entity === selectedCharacter);
    const missionTrendMap = new Map();
    trendDf.forEach(r => {
        const key = `${r.snapshot_order}|${r.mission_label}`;
        const current = missionTrendMap.get(key) || { mission: r.mission_label, order: r.snapshot_order, value: 0 };
        current.value += Number(r.cumulative_total || 0);
        missionTrendMap.set(key, current);
    });
    const mission_trend = [...missionTrendMap.values()]
        .sort((a, b) => a.order - b.order)
        .map(({ mission, value }) => ({ mission, value }));

    const ranking_df = [...metricSnapshotDf].sort((a, b) => {
        const diff = Number(b.cumulative_total || 0) - Number(a.cumulative_total || 0);
        return diff || String(a.entity).localeCompare(String(b.entity), 'pt-BR');
    });
    const character_ranking = ranking_df.map(r => ({
        name: r.entity,
        value: Number(r.cumulative_total || 0),
        increment: Number(r.increment_since_previous_snapshot || 0)
    }));

    const character_share = ranking_df
        .filter(r => Number(r.cumulative_total || 0) > 0)
        .map(r => ({ name: r.entity, value: Number(r.cumulative_total || 0) }));

    let mixDf = snapshotDf.filter(r => r.metric_available);
    if (selectedCharacter) mixDf = mixDf.filter(r => r.entity === selectedCharacter);
    const mixMap = new Map();
    mixDf.forEach(r => {
        const current = mixMap.get(r.metric) || 0;
        mixMap.set(r.metric, current + Number(r.cumulative_total || 0));
    });
    const metric_mix = [...mixMap.entries()]
        .map(([metric, value]) => ({ name: DISPLAY_METRICS[metric] || metric, value, metric_key: metric }))
        .sort((a, b) => b.value - a.value);

    const allTimelineSource = groupDf.filter(r => r.metric === selectedMetric && r.metric_available);
    let charactersForTimeline;
    if (selectedCharacter) {
        charactersForTimeline = [selectedCharacter];
    } else {
        const maxByCharacter = new Map();
        allTimelineSource.forEach(r => {
            const current = maxByCharacter.get(r.entity) || 0;
            maxByCharacter.set(r.entity, Math.max(current, Number(r.cumulative_total || 0)));
        });
        charactersForTimeline = [...maxByCharacter.entries()]
            .filter(([, value]) => value > 0)
            .sort((a, b) => (b[1] - a[1]) || String(a[0]).localeCompare(String(b[0]), 'pt-BR'))
            .map(([name]) => name);
    }

    const characters_timeline = charactersForTimeline.map(name => {
        const rows = allTimelineSource
            .filter(r => r.entity === name)
            .sort((a, b) => a.snapshot_order - b.snapshot_order);
        return {
            name,
            data: rows.map(r => Number(r.cumulative_total || 0)),
            missions: rows.map(r => r.mission_label)
        };
    });

    const totalAccumulated = metricSnapshotDf.reduce((acc, row) => acc + Number(row.cumulative_total || 0), 0);
    const totalFocusAvatar = selectedCharacter || (ranking_df[0]?.name || pcRankingDf[0]?.entity || npcRankingDf[0]?.entity || '');
    const totalFocusName = selectedCharacter ? `Foco em ${selectedCharacter}` : 'Visão geral';
    const characterMetricKpis = selectedCharacter ? {
        damageApplied: getMetricValueForCharacter(snapshotDf, 'DANO_APLICADO', selectedCharacter),
        damageReceived: getMetricValueForCharacter(snapshotDf, 'DANO_RECEBIDO', selectedCharacter),
        heatApplied: getMetricValueForCharacter(snapshotDf, 'HEAT_APLICADO', selectedCharacter),
        kills: getMetricValueForCharacter(snapshotDf, 'ABATES', selectedCharacter),
        scans: getMetricValueForCharacter(snapshotDf, 'SCANS', selectedCharacter),
    } : null;

    const kpis = {
        selected_mission: selectedMission,
        selected_metric: DISPLAY_METRICS[selectedMetric] || selectedMetric,
        selected_group: selectedGroup || 'Todos',
        selected_character: selectedCharacter,
        metric_key: selectedMetric,
        total_accumulated: totalAccumulated,
        total_focus_avatar: totalFocusAvatar,
        total_focus_name: totalFocusName,
        character_metric_kpis: characterMetricKpis,
        pc_leader: pcRankingDf.length ? { name: pcRankingDf[0].entity, value: Number(pcRankingDf[0].cumulative_total || 0) } : null,
        npc_leader: npcRankingDf.length ? { name: npcRankingDf[0].entity, value: Number(npcRankingDf[0].cumulative_total || 0) } : null,
        last_updated: selectedMission,
    };

    const filter_options = {
        missions: missions.map(m => m.mission_label),
        metrics: metrics.map(key => ({ value: key, label: DISPLAY_METRICS[key] })),
        groups: ['PCs', 'NPCs'],
        characters: availableCharacters,
    };
    const active_filters = {
        mission: selectedMission,
        metric: selectedMetric,
        character: selectedCharacter,
        group: selectedGroup,
    };

    return {
        kpis,
        mission_trend,
        character_ranking,
        character_share,
        metric_mix,
        characters_timeline,
        filter_options,
        active_filters,
        avatar_characters: avatarCharacters,
        romantic_mode: romanticMode,
    };
}

function buildMissionTrendChart(data, romanticMode = false) {
    const chart = initChart('revenueChart');
    const palette = getThemePalette(romanticMode);
    chart.setOption({
        color: palette.colors,
        tooltip: { trigger: 'axis' },
        grid: { left: 48, right: 24, top: 36, bottom: 42 },
        xAxis: { type: 'category', data: data.map(item => item.mission), axisLabel: { color: palette.axis, rotate: 25 } },
        yAxis: { type: 'value', axisLabel: { color: palette.axis }, splitLine: { lineStyle: { color: palette.split } } },
        series: [{ name: 'Acumulado', type: 'line', smooth: true, symbolSize: 8, lineStyle: { width: 3 }, areaStyle: { color: palette.area }, data: data.map(item => item.value) }],
    }, true);
}


function buildRankingChart(data, romanticMode = false) {
    const chart = initChart('categoryChart');
    const palette = getThemePalette(romanticMode);
    const sorted = [...data].sort((a, b) => a.value - b.value);
    chart.setOption({
        color: [palette.colors[0]],
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: params => {
                const source = sorted[params[0].dataIndex];
                return `${source.name}<br/>Total: ${numberFmt.format(source.value)}<br/>Incremento: ${numberFmt.format(source.increment)}`;
            },
        },
        grid: { left: 90, right: 20, top: 20, bottom: 20 },
        xAxis: { type: 'value', axisLabel: { color: palette.axis }, splitLine: { lineStyle: { color: palette.split } } },
        yAxis: { type: 'category', data: sorted.map(item => item.name), axisLabel: { color: palette.axis } },
        series: [{ type: 'bar', data: sorted.map(item => item.value), itemStyle: { borderRadius: [0, 8, 8, 0] }, label: { show: true, position: 'right', color: palette.text }, barMaxWidth: 28 }],
    }, true);
}


function buildShareChart(data, metricLabel, romanticMode = false) {
    const chart = initChart('regionChart');
    const palette = getThemePalette(romanticMode);
    updateShareChartTitle(metricLabel);
    chart.setOption({
        color: palette.colors,
        tooltip: { trigger: 'item', formatter: params => `${params.name}<br/>Total: ${numberFmt.format(params.value)}<br/>${params.percent}%` },
        legend: { bottom: 0, textStyle: { color: palette.text } },
        series: [{
            type: 'pie',
            radius: ['40%', '72%'],
            center: ['50%', '44%'],
            itemStyle: { borderRadius: 10, borderColor: palette.border, borderWidth: 3 },
            label: { color: palette.text, formatter: '{b}\n{d}%' },
            data: data.map(item => ({ ...item, itemStyle: { color: getCharacterColor(item.name, palette) } })),
        }],
    }, true);
}


function buildMetricMixChart(data, romanticMode = false) {
    const chart = initChart('ticketChart');
    const palette = getThemePalette(romanticMode);
    const sorted = [...data].sort((a, b) => b.value - a.value);
    chart.setOption({
        color: palette.colors,
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: 44, right: 24, top: 26, bottom: 78 },
        xAxis: { type: 'category', data: sorted.map(item => item.name), axisLabel: { color: palette.axis, rotate: 28 } },
        yAxis: { type: 'value', axisLabel: { color: palette.axis }, splitLine: { lineStyle: { color: palette.split } } },
        series: [{ type: 'bar', data: sorted.map(item => item.value), barMaxWidth: 34, itemStyle: { borderRadius: [8, 8, 0, 0] }, label: { show: true, position: 'top', color: palette.text } }],
    }, true);
}


function buildCharactersTimelineChart(seriesData, romanticMode = false) {
    const chart = initChart('productChart');
    const palette = getThemePalette(romanticMode);
    const missions = seriesData.length ? seriesData[0].missions : [];
    chart.setOption({
        color: seriesData.map(item => getCharacterColor(item.name, palette)),
        tooltip: { trigger: 'axis' },
        legend: { top: 4, textStyle: { color: palette.text } },
        grid: { left: 44, right: 24, top: 54, bottom: 42 },
        xAxis: { type: 'category', data: missions, axisLabel: { color: palette.axis, rotate: 25 } },
        yAxis: { type: 'value', axisLabel: { color: palette.axis }, splitLine: { lineStyle: { color: palette.split } } },
        series: seriesData.map(item => ({
            name: item.name,
            type: 'line',
            smooth: true,
            showSymbol: false,
            emphasis: { focus: 'series' },
            lineStyle: { width: 3, color: getCharacterColor(item.name, palette) },
            itemStyle: { color: getCharacterColor(item.name, palette) },
            data: item.data,
        })),
    }, true);
}


function renderDashboard(filters = getFilters()) {
    const payload = buildDashboardData(allStats, filters);
    syncFilterOptions(payload.filter_options, payload.active_filters);
    setRomanticTheme(payload.romantic_mode);
    renderAvatarStrip(payload.avatar_characters, payload.active_filters.character);
    setKpis(payload.kpis);
    updateRevenuePill(payload.active_filters, payload.kpis);
    buildMissionTrendChart(payload.mission_trend, payload.romantic_mode);
    buildRankingChart(payload.character_ranking, payload.romantic_mode);
    buildShareChart(payload.character_share, payload.kpis.selected_metric, payload.romantic_mode);
    buildMetricMixChart(payload.metric_mix, payload.romantic_mode);
    buildCharactersTimelineChart(payload.characters_timeline, payload.romantic_mode);
}

async function loadData() {
    const response = await fetch('./data/lancer_stats_long.json');
    allStats = await response.json();
    renderDashboard();
}

function clearFilters() {
    document.getElementById('missionFilter').value = '';
    document.getElementById('metricFilter').value = '';
    document.getElementById('groupFilter').value = '';
    document.getElementById('characterFilter').value = '';
    renderDashboard();
}

document.getElementById('applyFilters').addEventListener('click', () => renderDashboard());
document.getElementById('clearFilters').addEventListener('click', clearFilters);
document.getElementById('groupFilter').addEventListener('change', () => {
    document.getElementById('characterFilter').value = '';
    renderDashboard();
});
window.addEventListener('resize', () => Object.values(charts).forEach(chart => chart.resize()));
loadData().catch(error => console.error('Falha ao carregar dashboard:', error));
