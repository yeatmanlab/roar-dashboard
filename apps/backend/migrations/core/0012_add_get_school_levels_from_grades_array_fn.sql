-- Add get_school_levels_from_grades_array function
-- Maps an array of app.grade to a deduplicated, ordered array of app.school_level using the existing scalar function
-- app.get_school_level_from_grade(grade). 

CREATE OR REPLACE FUNCTION app.get_school_levels_from_grades_array(grades app.grade[])
  RETURNS app.school_level[]
  LANGUAGE sql
  IMMUTABLE
  STRICT
AS $$
  SELECT ARRAY(
    SELECT DISTINCT lvl
    FROM (
      SELECT app.get_school_level_from_grade(g) AS lvl
      FROM unnest(grades) AS g
    ) s
    WHERE lvl IS NOT NULL
    ORDER BY lvl
  );
$$;