-- Enrich Meta delivery-failure messages on automation_logs with Hebrew ops
-- guidance (131049 engagement, 131042 payment, etc.) so run history is actionable.

CREATE OR REPLACE FUNCTION public.mark_automation_log_delivery_failure(
  p_provider_message_id text,
  p_error jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
  v_code text;
  v_detail text;
  v_reason text;
  v_ops text;
BEGIN
  IF coalesce(p_provider_message_id, '') = '' THEN
    RETURN false;
  END IF;

  SELECT id INTO v_log_id
  FROM public.automation_logs
  WHERE triggered_at > now() - interval '7 days'
    AND jsonb_path_query_array(response, '$.**.messageId'::jsonpath, '{}'::jsonb, false)
        @> to_jsonb(p_provider_message_id)
  ORDER BY triggered_at DESC
  LIMIT 1;

  IF v_log_id IS NULL THEN
    RETURN false;
  END IF;

  v_code := nullif(p_error->>'code', '');
  v_detail := coalesce(
    nullif(p_error->'error_data'->>'details', ''),
    nullif(p_error->>'title', ''),
    nullif(p_error->>'message', ''),
    'סיבה לא ידועה'
  );

  IF v_code = '131049' THEN
    v_reason := 'Meta חסמה את המסירה (קוד 131049) — מגבלת מעורבות/איכות על הודעות שיווקיות לנמען זה.';
    v_ops := 'תפעול: בדקו Quality Rating ב-Meta, הפחיתו נפח תבניות לנמענים שלא מגיבים. אל תריצו מחדש מיד.';
  ELSIF v_code = '131042' THEN
    v_reason := 'Meta לא שלחה בגלל בעיית תשלום/חיוב בחשבון WhatsApp Business (קוד 131042).';
    v_ops := 'תפעול: Meta Business → WhatsApp Manager → Billing — תקנו אמצעי תשלום/חוב.';
  ELSIF v_code = '131026' THEN
    v_reason := 'Meta דיווחה שההודעה לא ניתנת למשלוח (קוד 131026).';
    v_ops := 'תפעול: בדקו שמספר הלקוח תקין ופעיל ב-WhatsApp.';
  ELSIF v_code = '131047' THEN
    v_reason := 'חלון השירות של 24 שעות נסגר (קוד 131047). יש לשלוח תבנית מאושרת.';
    v_ops := 'תפעול: העבירו את השלב ל-template.';
  ELSIF v_code = '200' THEN
    v_reason := 'אין הרשאה לשלוח בשם חשבון ה-WhatsApp Business (קוד 200).';
    v_ops := 'תפעול: חדשו חיבור Meta WhatsApp ב-AIOS.';
  ELSE
    v_reason := 'Meta לא מסרה את ההודעה'
      || coalesce(' (קוד ' || v_code || ')', '')
      || ': ' || v_detail;
    v_ops := 'תפעול: בדקו סטטוס המספר ב-Meta Business Manager.';
  END IF;

  UPDATE public.automation_logs
  SET success = false,
      error_message = left(
        coalesce(nullif(error_message, '') || ' | ', '')
          || v_reason
          || ' — '
          || v_ops,
        1000
      )
  WHERE id = v_log_id
    AND (success IS DISTINCT FROM false OR coalesce(error_message, '') NOT LIKE '%' || v_reason || '%');

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_automation_log_delivery_failure(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_automation_log_delivery_failure(text, jsonb) TO service_role;
