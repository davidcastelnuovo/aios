-- Regression checks use synthetic documents only and roll back every write.
BEGIN;
CREATE TEMP TABLE signature_qa_results (test text, passed boolean) ON COMMIT DROP;
DO $test$
DECLARE
  tenant uuid; creator uuid; doc uuid; recipient1 uuid; token1 uuid; token2 uuid;
  png text := 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAoCAYAAAAIeF9DAAABaklEQVR4nO2a2w4CIQxEV///n/XJmBAo0E4vkDkvJuoC7TDtLvo8hBBCCGn5NK9H8MpegBM9EY6I9Z29gECOcMoRu2aTlcSXjTvCIdm1vJf8sm7x3inRtbyd7yV85r0WFZ4Oid6Fs/mOcIqXIFKgUUnoCTASpYwwHpZdDQ45t1SqVq9Zvc4VtENGQVYsFxXXBBVktuO8dp/GHdJ3U0VBCbJq//Y9a/CI5JXqKwhBrLUYGbjWhWXKqlUQjRio0mUpVSPSRbEIYnEGunQhSRUF2dStO3QnaA93zMYL6StaQRAJ0e7EyAfLcLdoBKnQhNFj7I7vJsquIB5Ptzv9xLtUjQgTZUeQyKOGSk3+R0hfWRXEWwzN2VPGuZN7X1kRJMoZUumq5ph2rbB8zATJPhEdCZF+Kvv81wBdizRYlhiaH5quYeSQTGdcnfAZPUGyy5Q03/Vi9QRxa1jERoU7m+y/EBFCCCGEEELI9XwB8rdKLSjw0x0AAAAASUVORK5CYII=';
  fields jsonb; values jsonb; result jsonb; message text;
BEGIN
  SELECT tenant_id, created_by INTO tenant, creator FROM public.signature_documents LIMIT 1;
  IF tenant IS NULL THEN RAISE EXCEPTION 'Requires an existing tenant/document owner'; END IF;
  fields := '[{"id":"name","type":"full_name","required":true,"recipient_index":0,"position":{"page":1}},
    {"id":"stamp","type":"signature_stamp","required":true,"recipient_index":0,"position":{"page":1}},
    {"id":"signature2","type":"signature","required":true,"recipient_index":0,"position":{"page":2}}]'::jsonb;
  values := jsonb_build_object('name','QA Signer','stamp',png,'signature2',png,'__stamp_name','QA Company','__stamp_company_id','123456789');
  INSERT INTO public.signature_documents (tenant_id,created_by,title,content,status,document_fields)
    VALUES (tenant,creator,'QA ROLLBACK signature integrity','Synthetic QA only','pending',fields) RETURNING id INTO doc;
  INSERT INTO public.signature_recipients (document_id,tenant_id,name,email,sign_order)
    VALUES (doc,tenant,'QA Signer','qa@example.invalid',1) RETURNING id,sign_token INTO recipient1,token1;
  INSERT INTO public.signature_recipients (document_id,tenant_id,name,email,sign_order)
    VALUES (doc,tenant,'QA Second','qa2@example.invalid',2) RETURNING sign_token INTO token2;
  BEGIN
    PERFORM public.submit_signature_by_token(token1,'',NULL,values);
    RAISE EXCEPTION 'Expected rejection';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS message = MESSAGE_TEXT;
    INSERT INTO signature_qa_results VALUES ('empty signature rejected',message='invalid_signature');
  END;
  BEGIN
    PERFORM public.submit_signature_by_token(token1,png,NULL,'{}'::jsonb);
    RAISE EXCEPTION 'Expected rejection';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS message = MESSAGE_TEXT;
    INSERT INTO signature_qa_results VALUES ('required fields enforced',message='missing_required_field');
  END;
  BEGIN
    PERFORM public.submit_signature_by_token(token1,png,NULL,values - 'signature2');
    RAISE EXCEPTION 'Expected rejection';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS message = MESSAGE_TEXT;
    INSERT INTO signature_qa_results VALUES ('required signature on page two enforced',message='missing_required_field');
  END;
  BEGIN
    PERFORM public.submit_signature_by_token(token1,png,NULL,values - '__stamp_name' - '__stamp_company_id');
    RAISE EXCEPTION 'Expected rejection';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS message = MESSAGE_TEXT;
    INSERT INTO signature_qa_results VALUES ('stamp details enforced',message='missing_stamp_details');
  END;
  UPDATE public.signature_documents SET status='cancelled' WHERE id=doc;
  BEGIN
    PERFORM public.submit_signature_by_token(token1,png,NULL,values);
    RAISE EXCEPTION 'Expected rejection';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS message = MESSAGE_TEXT;
    INSERT INTO signature_qa_results VALUES ('cancelled document rejected',message='document_not_signable');
  END;
  UPDATE public.signature_documents SET status='pending' WHERE id=doc;
  result := public.submit_signature_by_token(token1,png,NULL,values);
  INSERT INTO signature_qa_results VALUES ('first signer leaves document partial',result->>'document_status'='partially_signed');
  INSERT INTO signature_qa_results SELECT 'all-page signatures and stamp persisted', field_values=values FROM public.signature_recipients WHERE id=recipient1;
  result := public.submit_signature_by_token(token2,png,NULL,'{}'::jsonb);
  INSERT INTO signature_qa_results VALUES ('all signers complete document',result->>'document_status'='completed');
  BEGIN
    PERFORM public.submit_signature_by_token(token1,png,NULL,values);
    RAISE EXCEPTION 'Expected rejection';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS message = MESSAGE_TEXT;
    INSERT INTO signature_qa_results VALUES ('duplicate submission rejected',message='not_found_or_already_signed');
  END;
  INSERT INTO public.signature_documents (tenant_id,created_by,title,content,status)
    VALUES (tenant,creator,'QA ROLLBACK decline','Synthetic QA only','pending') RETURNING id INTO doc;
  INSERT INTO public.signature_recipients (document_id,tenant_id,name,email,sign_order)
    VALUES (doc,tenant,'QA Decline','qa@example.invalid',1) RETURNING id,sign_token INTO recipient1,token1;
  INSERT INTO public.signature_recipients (document_id,tenant_id,name,email,sign_order)
    VALUES (doc,tenant,'QA Pending','qa2@example.invalid',2) RETURNING sign_token INTO token2;
  result := public.decline_signature_by_token(token1,'127.0.0.1');
  INSERT INTO signature_qa_results VALUES ('decline cancels document',result->>'document_status'='cancelled');
  INSERT INTO signature_qa_results SELECT 'decline event recorded once',count(*)=1 FROM public.signature_events WHERE document_id=doc AND recipient_id=recipient1 AND event_type='declined';
  UPDATE public.signature_documents SET status='partially_signed' WHERE id=doc;
  BEGIN
    PERFORM public.submit_signature_by_token(token2,png,NULL,'{}'::jsonb);
    RAISE EXCEPTION 'Expected rejection';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS message = MESSAGE_TEXT;
    INSERT INTO signature_qa_results VALUES ('declined signer prevents completion',message='document_not_signable');
  END;
END;
$test$;
INSERT INTO signature_qa_results SELECT 'anonymous mutation RPCs denied',
  NOT has_function_privilege('anon','public.submit_signature_by_token(uuid,text,text,jsonb)','EXECUTE')
  AND NOT has_function_privilege('anon','public.submit_signature_by_token(uuid,text,text)','EXECUTE')
  AND NOT has_function_privilege('anon','public.decline_signature_by_token(uuid,text)','EXECUTE')
  AND NOT has_function_privilege('anon','public.log_signature_event(uuid,uuid,text,text,jsonb)','EXECUTE');
DO $$ BEGIN IF EXISTS(SELECT 1 FROM signature_qa_results WHERE NOT passed) THEN
  RAISE EXCEPTION 'Signature regression failed: %', (SELECT jsonb_agg(to_jsonb(r)) FROM signature_qa_results r WHERE NOT passed);
END IF; END $$;
SELECT * FROM signature_qa_results;
ROLLBACK;
