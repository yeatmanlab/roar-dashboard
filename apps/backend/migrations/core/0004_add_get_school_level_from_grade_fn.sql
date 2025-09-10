-- Add get_school_level_from_grade function
-- This function is used to automatically derive the school level from the grade.

CREATE OR REPLACE FUNCTION app.get_school_level_from_grade(grade app.grade)
  RETURNS app.school_level
  LANGUAGE sql
  IMMUTABLE
  RETURNS NULL ON NULL INPUT
AS $$
  SELECT CASE grade
    -- early childhood
    WHEN 'InfantToddler'::app.grade            THEN 'early_childhood'::app.school_level
    WHEN 'Preschool'::app.grade                THEN 'early_childhood'::app.school_level
    WHEN 'PreKindergarten'::app.grade          THEN 'early_childhood'::app.school_level
    WHEN 'TransitionalKindergarten'::app.grade THEN 'early_childhood'::app.school_level

    -- elementary (K, 1–5)
    WHEN 'Kindergarten'::app.grade THEN 'elementary'::app.school_level
    WHEN '1'::app.grade            THEN 'elementary'::app.school_level
    WHEN '2'::app.grade            THEN 'elementary'::app.school_level
    WHEN '3'::app.grade            THEN 'elementary'::app.school_level
    WHEN '4'::app.grade            THEN 'elementary'::app.school_level
    WHEN '5'::app.grade            THEN 'elementary'::app.school_level

    -- middle (6–8)
    WHEN '6'::app.grade THEN 'middle'::app.school_level
    WHEN '7'::app.grade THEN 'middle'::app.school_level
    WHEN '8'::app.grade THEN 'middle'::app.school_level

    -- high (9–12)
    WHEN '9'::app.grade  THEN 'high'::app.school_level
    WHEN '10'::app.grade THEN 'high'::app.school_level
    WHEN '11'::app.grade THEN 'high'::app.school_level
    WHEN '12'::app.grade THEN 'high'::app.school_level

    -- postsecondary (13, PostGraduate)
    WHEN '13'::app.grade           THEN 'postsecondary'::app.school_level
    WHEN 'PostGraduate'::app.grade THEN 'postsecondary'::app.school_level

    -- explicit no-level cases
    WHEN ''::app.grade         THEN NULL
    WHEN 'Ungraded'::app.grade THEN NULL
    WHEN 'Other'::app.grade    THEN NULL

    ELSE NULL
  END;
$$;