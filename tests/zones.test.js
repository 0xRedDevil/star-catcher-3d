import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ZONES, ZONE_LENGTH, zoneAt } from '../js/zones.js';
import { ZONE_STYLES } from '../js/trackMesh.js';

test('zones go in order every 600 units', () => {
    assert.equal(ZONE_LENGTH, 600);
    assert.deepEqual(ZONES.map(z => z.name), ['Starlight Sea', 'Candy Nebula', 'Crystal Galaxy', 'Rainbow Moon']);
    assert.equal(zoneAt(0).zone.id, 'starlight');
    assert.equal(zoneAt(599.9).zone.id, 'starlight');
    assert.equal(zoneAt(600).zone.id, 'candy');
    assert.equal(zoneAt(1200).zone.id, 'crystal');
    assert.equal(zoneAt(1800).zone.id, 'rainbow');
    assert.equal(zoneAt(1800).startS, 1800);
});

test('zones repeat with a lap number', () => {
    assert.equal(zoneAt(0).name, 'Starlight Sea');
    assert.equal(zoneAt(2400).name, 'Starlight Sea II');
    assert.equal(zoneAt(2400).lap, 1);
    assert.equal(zoneAt(5000).lap, 2);
    assert.equal(zoneAt(5000).name, 'Starlight Sea III');
    assert.equal(zoneAt(5000).index, 8);
});

test('every zone has a track style and sky colours', () => {
    for (const zone of ZONES) {
        assert.ok(ZONE_STYLES[zone.id], `${zone.id} style`);
        assert.ok(Number.isInteger(zone.sky), `${zone.id} sky`);
        assert.ok(zone.nebula.length >= 2, `${zone.id} nebula`);
    }
    assert.equal(ZONE_STYLES.rainbow.road, 'stripes');
});
