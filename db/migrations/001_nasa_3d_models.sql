-- Add the NASA 3D Resources source and one model row per bundled model.
-- Forward-only. Safe to re-run: source insert is idempotent and model rows are
-- inserted only when the artifact + URL pair is absent.

BEGIN;

INSERT INTO source (
    source_id, name, homepage_url, license_name, license_url, citation,
    terms_note, update_cadence, last_release
) VALUES (
    'nasa_3d',
    'NASA 3D Resources',
    'https://github.com/nasa/NASA-3D-Resources',
    'NASA public domain (per-asset credit)',
    'https://www.nasa.gov/nasa-brand-center/images-and-media/',
    'NASA 3D Resources, https://github.com/nasa/NASA-3D-Resources.',
    'Preserve the per-model credit. Models are served from the application bundle unless a remote asset is used.',
    'per asset',
    NULL
)
ON CONFLICT (source_id) DO NOTHING;

WITH targets(slug, url, title, credit) AS (
    VALUES
        ('opportunity', '/models/opportunity.glb', 'Opportunity 3D model', 'NASA 3D Resources — Mars Exploration Rover Opportunity (MER-B)'),
        ('apollo-11-lunar-module-eagle', '/models/apollo-lm.glb', 'Apollo Lunar Module 3D model', 'NASA 3D Resources — Apollo Lunar Module'),
        ('insight', '/models/insight.glb', 'InSight lander 3D model', 'NASA 3D Resources — InSight Cruise Lander'),
        ('skylab', '/models/skylab.glb', 'Skylab 3D model', 'NASA 3D Resources — Skylab'),
        ('voyager-1', '/models/voyager.glb', 'Voyager 3D model', 'NASA 3D Resources — Voyager Probe'),
        ('pioneer-10', '/models/pioneer.glb', 'Pioneer 10 3D model', 'NASA 3D Resources — Pioneer 10')
)
INSERT INTO media (
    artifact_id, url, title, credit, license_name, license_url,
    media_type, is_primary, source_id
)
SELECT
    a.artifact_id, t.url, t.title, t.credit,
    'NASA public domain (per-asset credit)',
    'https://www.nasa.gov/nasa-brand-center/images-and-media/',
    'model', false, 'nasa_3d'
FROM targets t
JOIN artifact a ON a.slug = t.slug
WHERE NOT EXISTS (
    SELECT 1
    FROM media m
    WHERE m.artifact_id = a.artifact_id
      AND m.media_type = 'model'
      AND m.url = t.url
);

COMMIT;
