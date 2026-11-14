-- ============================================================================
--  Lineage without a graph server.
--
--  Walk parent/child links from one artifact down to a bounded depth.
--  Replace the slug. Works because v_artifact_edge already unions curated
--  relations with resolved GCAT parent links.
-- ============================================================================

WITH RECURSIVE lineage AS (
    SELECT
        a.artifact_id,
        a.slug,
        a.canonical_name,
        0 AS depth,
        ARRAY[a.slug] AS path
    FROM artifact a
    WHERE a.slug = 'apollo-11-lunar-module-eagle'

    UNION ALL

    SELECT
        child.artifact_id,
        child.slug,
        child.canonical_name,
        lineage.depth + 1,
        lineage.path || child.slug
    FROM lineage
    JOIN v_artifact_edge e ON e.parent_id = lineage.artifact_id
    JOIN artifact child ON child.artifact_id = e.child_id
    WHERE lineage.depth < 6
      AND NOT child.slug = ANY(lineage.path)   -- cycle guard
)
SELECT DISTINCT
    depth,
    slug,
    canonical_name,
    path
FROM lineage
ORDER BY depth, slug;
