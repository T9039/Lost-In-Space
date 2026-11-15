-- ============================================================================
--  Live Earth-orbit lookup.
--
--  Only artifacts with a SATCAT identifier can be propagated. Everything on
--  the Moon, Mars or in deep space shows its last known position instead.
-- ============================================================================

SELECT
    a.slug,
    a.canonical_name,
    ac.value::bigint AS satcat_no,
    g.epoch,
    g.inclination_deg,
    g.raan_deg,
    g.eccentricity,
    g.arg_perigee_deg,
    g.mean_anomaly_deg,
    g.mean_motion_rev_day,
    g.bstar,
    g.fetched_at
FROM artifact a
JOIN artifact_catalog_id ac
    ON ac.artifact_id = a.artifact_id
   AND ac.scheme = 'SATCAT'
   AND ac.value ~ '^[0-9]+$'
JOIN LATERAL (
    SELECT *
    FROM gp_element g
    WHERE g.satcat_no = ac.value::bigint
    ORDER BY g.epoch DESC
    LIMIT 1
) g ON true
WHERE a.is_curated = true
ORDER BY a.canonical_name;
