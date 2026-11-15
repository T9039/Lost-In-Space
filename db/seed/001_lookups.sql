-- ============================================================================
--  Lost in Space — reference data and source registry
--  Apply after db/schema.sql
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Sources and their exact attribution lines
-- ---------------------------------------------------------------------------

INSERT INTO source (
    source_id, name, homepage_url, license_name, license_url, citation,
    terms_note, update_cadence, last_release
) VALUES
('gcat',
 'General Catalog of Artificial Space Objects (GCAT)',
 'https://planet4589.org/space/gcat/',
 'CC-BY-4.0',
 'https://creativecommons.org/licenses/by/4.0/',
 'McDowell, Jonathan C. General Catalog of Artificial Space Objects (GCAT), https://planet4589.org/space/gcat/',
 'May be copied, redistributed and adapted with attribution. Cite the catalog and the release date.',
 'daily',
 '1.8.9'),

('nssdca',
 'NASA Space Science Data Coordinated Archive (NSSDCA)',
 'https://nssdc.gsfc.nasa.gov/',
 'NASA public domain (unless otherwise noted)',
 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
 'NASA Space Science Data Coordinated Archive (NSSDCA), NASA Goddard Space Flight Center.',
 'NASA material is generally not copyrighted; individual images and third-party text may carry separate credits. Check each item.',
 'per mission page',
 NULL),

('space_artefacts',
 'Space Artefacts',
 'https://spaceartefacts.com/',
 'Free duplication with attribution (custom, not CC-BY)',
 'https://spaceartefacts.com/legal-notice',
 'Space Artefacts — Man-made objects wandering across the Solar System, https://spaceartefacts.com/',
 'Tables may be duplicated if the site and author are cited. Do not relabel this data as CC-BY.',
 'irregular',
 NULL),

('celestrak',
 'CelesTrak',
 'https://celestrak.org/',
 'CelesTrak free-use policy (not a CC license)',
 'https://celestrak.org/usage-policy.php',
 'CelesTrak, https://celestrak.org/ (Dr T. S. Kelso). GP data originated by the US Space Force.',
 'Cache aggressively and fetch on a schedule only. Never query per user request. Use OMM/JSON or CSV, not TLE, for 6-digit catalog numbers.',
 'about every 2 hours',
 NULL),

('nasa_images',
 'NASA Image and Video Library',
 'https://images.nasa.gov/',
 'NASA public domain (per-image credit)',
 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
 'NASA Image and Video Library, https://images.nasa.gov/',
 'Proxy server-side. Preserve the credit line attached to each asset.',
 'continuous',
 NULL),

('nasa_3d',
 'NASA 3D Resources',
 'https://github.com/nasa/NASA-3D-Resources',
 'NASA public domain (per-asset credit)',
 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
 'NASA 3D Resources, https://github.com/nasa/NASA-3D-Resources.',
 'Preserve the per-model credit. Models are served from the application bundle unless a remote asset is used.',
 'per asset',
 NULL),

('nasa',
 'NASA mission pages',
 'https://science.nasa.gov/',
 'NASA public domain (unless otherwise noted)',
 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
 'NASA mission pages, https://science.nasa.gov/ and https://www.nasa.gov/.',
 'Mission prose and fact sheets. Individual images and contributed text may carry separate credits.',
 'per mission page',
 NULL),

('jpl_horizons',
 'JPL Horizons',
 'https://ssd.jpl.nasa.gov/horizons/',
 'NASA/JPL public domain',
 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
 'JPL Horizons System, NASA Jet Propulsion Laboratory, https://ssd.jpl.nasa.gov/horizons/',
 'Use for selected ephemerides only; do not bulk-poll.',
 'on demand',
 NULL),

('curated',
 'Lost in Space curation',
 'https://github.com/T9039/Lost-In-Space',
 'CC-BY-4.0 for data, MIT for code',
 NULL,
 'Lost in Space project, https://github.com/T9039/Lost-In-Space',
 'Human-curated facts must name the source they were verified against.',
 'continuous',
 NULL);

-- ---------------------------------------------------------------------------
-- SatType byte 1 (GCAT coarse object type)
-- ---------------------------------------------------------------------------

INSERT INTO sat_type_coarse (code, name, description) VALUES
('P', 'Payload',            'Payload intended for orbit or a suborbital trajectory.'),
('C', 'Component',          'Subsystem of a parent object, usually designed to separate.'),
('R', 'Launch vehicle stage','A stage of a launch vehicle.'),
('D', 'Fragmentation debris','Piece produced by a breakup, explosion, collision or self-destruct.'),
('S', 'Suborbital payload', 'Sounding-rocket payload or missile re-entry vehicle.'),
('X', 'Deleted catalog entry','Entry used in auxiliary catalogs that has been deleted.'),
('Z', 'Spurious entry',     'Entry that existed in another catalog but has no real object.');

-- ---------------------------------------------------------------------------
-- Orbit categories (GCAT `OpOrbit`)
-- ---------------------------------------------------------------------------

INSERT INTO orbit_category (code, name, definition, sort_order) VALUES
('ATM',    'Atmospheric',              'Apogee height below 80 km.', 10),
('SO',     'Suborbital',               'Perigee below 0 km, apogee above 80 km.', 20),
('TA',     'Trans-atmospheric',        'Perigee 0-80 km, apogee above 80 km.', 30),
('LLEO/E', 'Lower LEO / equatorial',   'Height 80-600 km, inclination 0-25 deg.', 40),
('LLEO/I', 'Lower LEO / intermediate',  'Height 80-600 km, inclination 25-85 deg.', 41),
('LLEO/P', 'Lower LEO / polar',         'Height 80-600 km, inclination 85-95 deg.', 42),
('LLEO/S', 'Lower LEO / sun-synchronous','Height 80-600 km, inclination 95-104 deg.', 43),
('LLEO/R', 'Lower LEO / retrograde',    'Height 80-600 km, inclination 104-180 deg.', 44),
('LEO/E',  'Upper LEO / equatorial',    'Height 600-2000 km, inclination 0-25 deg.', 50),
('LEO/I',  'Upper LEO / intermediate',  'Height 600-2000 km, inclination 25-85 deg.', 51),
('LEO/P',  'Upper LEO / polar',         'Height 600-2000 km, inclination 85-95 deg.', 52),
('LEO/S',  'Upper LEO / sun-synchronous','Height 600-2000 km, inclination 95-104 deg.', 53),
('LEO/R',  'Upper LEO / retrograde',    'Height 600-2000 km, inclination 104-180 deg.', 54),
('MEO',    'Medium Earth orbit',        'Period 2:07-23:00 hours, eccentricity 0.00-0.50.', 60),
('HEO',    'Highly elliptical orbit',   'Period 4:03-23:00 hours, eccentricity 0.50-0.92.', 61),
('HEO/M',  'Molniya orbit',             'Period 11:30-12:30 hours, inclination 62-64 deg, eccentricity 0.50-0.77.', 62),
('GTO',    'Geotransfer orbit',         'Period 10:00-12:30 hours, inclination 0-85 deg, eccentricity 0.50-0.77.', 63),
('GEO/S',  'Stationary GEO',            'Period 23:55.5-23:56.5 hours, inclination 0-3 deg, eccentricity 0-0.01.', 70),
('GEO/I',  'Inclined GEO',              'Period 23:55.5-23:56.5 hours, inclination 3-25 deg, eccentricity 0-0.05.', 71),
('GEO/T',  'Synchronous',               'Period 23:55.5-23:56.5 hours, inclination 0-180 deg, eccentricity 0-0.85.', 72),
('GEO/D',  'Drift GEO',                 'Period 23:00-25:00 hours, inclination 0-3 deg, eccentricity 0-0.05.', 73),
('GEO/SI', 'Inclined GEO (stable)',     'Period 23:55.5-23:56.5 hours, inclination 3-25 deg, eccentricity 0-0.05.', 74),
('GEO/ID', 'Inclined drift GEO',        'Period 23:41-24:11 hours, inclination 3-25 deg, eccentricity 0-0.05.', 75),
('GEO/NS', 'Near-synchronous',          'Period 23:00-25:00 hours, inclination 0-180 deg, eccentricity 0-0.85.', 76),
('VHEO',   'Very high Earth orbit',     'Period above 25:00 hours, bound to Earth.', 80),
('DSO',    'Deep space orbit',          'Geocentric height 145,688-318,200 km.', 90),
('CLO',    'Cislunar / translunar',     'Geocentric height 318,200 km to 1.5 million km.', 91),
('EEO',    'Earth escape',              'Geocentric height below 1.5 million km, eccentricity above 1.0.', 92),
('HCO',    'Heliocentric',              'Heliocentric distance above 1.5 million km, eccentricity 0-1.0.', 93),
('PCO',    'Planetocentric',            'Bound to a central body other than Earth or the Sun.', 94),
('SSE',    'Solar System escape',       'Heliocentric eccentricity above 1.0.', 95);

-- ---------------------------------------------------------------------------
-- Phase status codes (GCAT `Status`)
-- ---------------------------------------------------------------------------

INSERT INTO phase_status (code, description, externality) VALUES
('O',       'In orbit; separated from parent at t1 and still in free flight.', 'Free'),
('AO',      'Attached in orbit; attached to parent from t1 to present.', 'External'),
('AO IN',   'Attached inside; inside parent from t1 to present.', 'Internal'),
('UDK',     'Undocked; docked to parent from t1 to t2, then separated.', 'External to free'),
('REL',     'Released; attached to parent from t1 to t2, then separated.', 'External to free'),
('DEP',     'Deployed; like REL, for objects on a planetary surface.', 'External to free'),
('TO',      'Takeoff from a small body that is not treated as a world.', 'Free'),
('TOA',     'Attached at takeoff from a small body.', 'External'),
('OX',      'Probably in orbit but lost; no recent tracking data.', 'Free'),
('E',       'Exploded; free in orbit until breakup at t2.', 'Free'),
('N',       'Renamed; name or owner changed at t2.', 'Free'),
('NA',      'Renamed while attached.', 'External'),
('LEASE',   'Temporary lease from the main owner.', 'Free'),
('S',       'Targeted suborbital entry or impact at the end of a launch trajectory.', 'Free'),
('R',       'Re-entered after natural decay.', 'Free'),
('D',       'De-orbited by an active manoeuvre.', 'Free'),
('L',       'Landed or splashed down on the central body surface.', 'Free'),
('LF',      'Failed landing; reached the surface but was destroyed on or immediately after impact.', 'Free'),
('AS',      'Suborbital re-entry while attached to the parent.', 'Attached'),
('AR',      'Re-entered while attached to the parent.', 'External'),
('AR IN',   'Re-entered inside the parent.', 'Internal'),
('AL',      'Landed while attached to the parent.', 'External'),
('AL IN',   'Landed inside the parent.', 'Internal'),
('TX',      'Transmission ended while operating on the central body surface.', 'Free'),
('F',       'Failed during launch; crashed or was destroyed at t2.', 'Free'),
('AF',      'Failed while attached; destroyed with the parent during launch failure.', 'External or internal'),
('DSO',     'Passed the deep-space boundary; deep-space catalog ID takes over.', 'Free'),
('DSA',     'Attached to the parent while passing the deep-space boundary.', 'External'),
('DSA IN',  'Inside the parent while passing the deep-space boundary.', 'Internal'),
('LO',      'Liftoff from a world other than Earth; catalog number is reassigned.', 'Free'),
('LOA',     'Liftoff from a world other than Earth while attached to the parent.', 'External or internal'),
('DK',      'Docked with the destination object at t2.', 'Free to external'),
('GRP',     'Grappled the destination object at t2.', 'Free to external'),
('ATT',     'Was attached to the parent at t1, then attached to the destination at t2.', 'External'),
('TFR',     'Transferred from inside the parent to inside the destination.', 'Internal'),
('TFR E',   'Transferred from inside the parent to the exterior of the destination.', 'Internal to external'),
('TFR IN',  'Transferred from outside the parent to the interior of the destination.', 'External to internal'),
('C',       'Collided with the destination object at t2.', 'Free'),
('EVA DP',  'Spacewalk depressurisation; began depressurising the airlock at t2.', 'Internal to external'),
('EVA RP',  'Spacewalk repressurisation; repressurised the airlock at t2.', 'Internal to tethered/free to internal'),
('REFLT',   'Reflight; the object was reassigned to a new catalog number on its next flight.', 'Not applicable'),
('EO',      'Escape; left the parent sphere of influence and entered the destination sphere of influence.', 'Free'),
('EAO',     'Escape while attached to the parent.', 'External'),
('EN',      'Encounter; a single flyby with periapsis at the orbit epoch.', 'Free'),
('OI',      'Orbit insertion around the destination body.', 'Free'),
('OE',      'Orbit escape from the central body.', 'Free'),
('ERR',     'Catalog or tracking error; no object corresponds to this entry.', 'Unknown');

COMMIT;
