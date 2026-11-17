-- Database-level test cases.   Run:  psql "$DATABASE_URL" -f tests/db_tests.sql
-- Each test prints PASS/FAIL. Everything runs in a transaction that is rolled back (data is untouched).
BEGIN;
CREATE TEMP TABLE t_results(name TEXT, outcome TEXT) ON COMMIT DROP;

DO $$
DECLARE n INT; v TEXT;
BEGIN
  BEGIN INSERT INTO app_user(name,email,password_hash,role) VALUES ('Zed','z@x.io','h','ROOT');
        INSERT INTO t_results VALUES ('T01 invalid role rejected','FAIL');
  EXCEPTION WHEN check_violation THEN INSERT INTO t_results VALUES ('T01 invalid role rejected','PASS'); END;

  BEGIN INSERT INTO app_user(name,email,password_hash,role) VALUES ('Zed','not-an-email','h','VIEWER');
        INSERT INTO t_results VALUES ('T02 invalid email rejected','FAIL');
  EXCEPTION WHEN check_violation THEN INSERT INTO t_results VALUES ('T02 invalid email rejected','PASS'); END;

  BEGIN INSERT INTO app_user(name,email,password_hash,role) VALUES ('Dup','admin@sentinel.io','h','VIEWER');
        INSERT INTO t_results VALUES ('T03 duplicate email rejected','FAIL');
  EXCEPTION WHEN unique_violation THEN INSERT INTO t_results VALUES ('T03 duplicate email rejected','PASS'); END;

  BEGIN INSERT INTO vulnerability(title,severity,resource_id) VALUES ('Bad severity','SEVERE',1);
        INSERT INTO t_results VALUES ('T04 invalid severity rejected','FAIL');
  EXCEPTION WHEN check_violation THEN INSERT INTO t_results VALUES ('T04 invalid severity rejected','PASS'); END;

  BEGIN INSERT INTO vulnerability(title,severity,detected_date,resource_id) VALUES ('Future','LOW',CURRENT_DATE+5,1);
        INSERT INTO t_results VALUES ('T05 future detected date rejected','FAIL');
  EXCEPTION WHEN check_violation THEN INSERT INTO t_results VALUES ('T05 future detected date rejected','PASS'); END;

  BEGIN INSERT INTO vulnerability(title,severity,resource_id) VALUES ('Orphan','LOW',99999);
        INSERT INTO t_results VALUES ('T06 foreign key enforced','FAIL');
  EXCEPTION WHEN foreign_key_violation THEN INSERT INTO t_results VALUES ('T06 foreign key enforced','PASS'); END;

  BEGIN INSERT INTO remediation(action_description,assigned_date,due_date,vulnerability_id,assigned_user_id)
        VALUES ('Fix it later', CURRENT_DATE, CURRENT_DATE-1, 1, 2);
        INSERT INTO t_results VALUES ('T07 due date must not precede assigned date','FAIL');
  EXCEPTION WHEN check_violation THEN INSERT INTO t_results VALUES ('T07 due date must not precede assigned date','PASS'); END;

  BEGIN INSERT INTO cloud_resource(name,type,ip_address,cloud_acc_id) VALUES ('bad-ip','VM','999.1.1.1',1);
        INSERT INTO t_results VALUES ('T08 invalid IP rejected (INET type)','FAIL');
  EXCEPTION WHEN invalid_text_representation THEN INSERT INTO t_results VALUES ('T08 invalid IP rejected (INET type)','PASS'); END;

  -- T09 trigger: a new CRITICAL finding raises the resource risk score by 10
  SELECT risk_score INTO n FROM cloud_resource WHERE resource_id = 12;
  INSERT INTO vulnerability(title,severity,resource_id) VALUES ('Trigger test finding','CRITICAL',12);
  INSERT INTO t_results SELECT 'T09 trigger raises risk score by 10', CASE WHEN risk_score = n + 10 THEN 'PASS' ELSE 'FAIL' END
    FROM cloud_resource WHERE resource_id = 12;

  BEGIN PERFORM fn_assign_remediation(1, 4, CURRENT_DATE+3, 'Some fix action');
        INSERT INTO t_results VALUES ('T10 viewer cannot be assignee','FAIL');
  EXCEPTION WHEN raise_exception THEN INSERT INTO t_results VALUES ('T10 viewer cannot be assignee','PASS'); END;

  -- T11/T12 function + triggers: assign -> complete -> vulnerability RESOLVED, completed_date auto-set
  PERFORM fn_assign_remediation(13, 3, CURRENT_DATE+3, 'Restrict SSH management port');
  UPDATE remediation SET status = 'COMPLETED' WHERE vulnerability_id = 13 AND status = 'PENDING';
  SELECT status INTO v FROM vulnerability WHERE vulnerability_id = 13;
  INSERT INTO t_results VALUES ('T11 completing remediation resolves vulnerability', CASE WHEN v = 'RESOLVED' THEN 'PASS' ELSE 'FAIL' END);
  INSERT INTO t_results SELECT 'T12 completed_date auto-filled', CASE WHEN completed_date = CURRENT_DATE THEN 'PASS' ELSE 'FAIL' END
    FROM remediation WHERE vulnerability_id = 13 AND status = 'COMPLETED';

  SELECT COUNT(*) INTO n FROM vulnerability WHERE search_vector @@ plainto_tsquery('english','encrypt');
  INSERT INTO t_results VALUES ('T13 full-text search stems "encrypted"', CASE WHEN n >= 3 THEN 'PASS' ELSE 'FAIL' END);

  PERFORM fn_run_compliance_scan(2);
  SELECT c.result INTO v FROM v_latest_checks c JOIN compliance_rule r ON r.rule_id = c.rule_id
   WHERE c.resource_id = 2 AND r.match_keyword = 'public';
  INSERT INTO t_results VALUES ('T14 compliance scan flags public bucket', CASE WHEN v = 'FAIL' THEN 'PASS' ELSE 'FAIL' END);

  DELETE FROM cloud_account WHERE cloud_acc_id = 3;
  SELECT COUNT(*) INTO n FROM vulnerability WHERE resource_id IN (7,8,9);
  INSERT INTO t_results VALUES ('T15 cascade delete removes account data', CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END);

  BEGIN DELETE FROM app_user WHERE user_id = 1;
        INSERT INTO t_results VALUES ('T16 user managing accounts cannot be deleted','FAIL');
  EXCEPTION WHEN foreign_key_violation THEN INSERT INTO t_results VALUES ('T16 user managing accounts cannot be deleted','PASS'); END;
END $$;

SELECT outcome, name FROM t_results ORDER BY name;
SELECT COUNT(*) FILTER (WHERE outcome='PASS') AS passed, COUNT(*) FILTER (WHERE outcome='FAIL') AS failed FROM t_results;
ROLLBACK;
