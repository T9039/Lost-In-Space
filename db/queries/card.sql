-- ============================================================================
--  Card read model — one row per artifact, app-ready shape.
-- ============================================================================

SELECT
    slug,
    canonical_name,
    short_name,
    primary_zone,
    sat_type_raw,
    mass_kg,
    dry_mass_kg,
    phase_count,
    first_start,
    last_end,
    current_status,
    primary_location_name,
    primary_body,
    latitude_deg,
    longitude_deg,
    satcat_no,
    gp_epoch
FROM v_artifact_card
WHERE is_curated = true
ORDER BY
    CASE primary_zone
        WHEN 'moon'        THEN 1
        WHEN 'mars'        THEN 2
        WHEN 'earth_orbit' THEN 3
        WHEN 'deep_space'  THEN 4
        ELSE 5
    END,
    canonical_name;
