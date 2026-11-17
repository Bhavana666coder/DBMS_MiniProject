-- Demo data. All demo users share the password:  Password@123   (bcrypt hash below)
INSERT INTO app_user(name, email, password_hash, role) VALUES
 ('Aarav Admin',  'admin@sentinel.io',   '$2a$10$rCThxA/RV//PuE.zJ3VKEuxt5fCDYZT0nmb7uj9mGy7zA/yleGXba', 'ADMIN'),
 ('Riya Analyst', 'riya@sentinel.io',    '$2a$10$rCThxA/RV//PuE.zJ3VKEuxt5fCDYZT0nmb7uj9mGy7zA/yleGXba', 'ANALYST'),
 ('Karan Analyst','karan@sentinel.io',   '$2a$10$rCThxA/RV//PuE.zJ3VKEuxt5fCDYZT0nmb7uj9mGy7zA/yleGXba', 'ANALYST'),
 ('Meera Viewer', 'meera@sentinel.io',   '$2a$10$rCThxA/RV//PuE.zJ3VKEuxt5fCDYZT0nmb7uj9mGy7zA/yleGXba', 'VIEWER');

INSERT INTO cloud_account(provider, account_name, region, status, user_id) VALUES
 ('AWS',   'prod-core',        'ap-south-1',   'ACTIVE', 1),
 ('AWS',   'dev-sandbox',      'us-east-1',    'ACTIVE', 2),
 ('AZURE', 'corp-subscription','centralindia', 'ACTIVE', 2),
 ('GCP',   'analytics-project','asia-south1',  'ACTIVE', 3);

INSERT INTO cloud_resource(name, type, ip_address, status, cloud_acc_id) VALUES
 ('prod-web-01',      'VM',       '10.0.1.11',  'RUNNING', 1),
 ('prod-assets-bucket','STORAGE',  NULL,         'RUNNING', 1),
 ('prod-db-primary',  'DATABASE', '10.0.2.5',   'RUNNING', 1),
 ('prod-vpc-sg',      'NETWORK',  NULL,         'RUNNING', 1),
 ('dev-build-server', 'VM',       '172.16.0.8', 'RUNNING', 2),
 ('dev-iam-roles',    'IAM',      NULL,         'RUNNING', 2),
 ('az-app-vm',        'VM',       '10.1.0.4',   'RUNNING', 3),
 ('az-sql-main',      'DATABASE', '10.1.1.9',   'RUNNING', 3),
 ('az-blob-archive',  'STORAGE',  NULL,         'RUNNING', 3),
 ('gcp-bq-warehouse', 'DATABASE', NULL,         'RUNNING', 4),
 ('gcp-gke-cluster',  'CONTAINER','10.2.0.3',   'RUNNING', 4),
 ('gcp-func-ingest',  'FUNCTION', NULL,         'STOPPED', 4);

INSERT INTO vulnerability(title, description, severity, detected_date, resource_id) VALUES
 ('SSH port open to the world',            'Security group allows inbound SSH from 0.0.0.0/0',            'HIGH',     CURRENT_DATE-12, 1),
 ('Outdated OpenSSL package',              'OpenSSL 1.0.2 contains known CVEs and is end of life',        'MEDIUM',   CURRENT_DATE-9,  1),
 ('Storage bucket is publicly accessible','Public read ACL allows anonymous download of objects',       'CRITICAL', CURRENT_DATE-14, 2),
 ('Storage volume not encrypted',          'Server side encryption is disabled on the bucket',            'HIGH',     CURRENT_DATE-20, 2),
 ('Database volume not encrypted at rest', 'Primary database storage uses an unencrypted volume',        'HIGH',     CURRENT_DATE-7,  3),
 ('Audit logging disabled',                'Database access events are not being logged',                 'MEDIUM',   CURRENT_DATE-25, 3),
 ('Security group allows all ports',       'Overly permissive inbound rule 0-65535 from any source',      'CRITICAL', CURRENT_DATE-5,  4),
 ('Default credentials in use',            'Build server still uses the vendor default admin password',  'CRITICAL', CURRENT_DATE-6,  5),
 ('Outdated Jenkins version',              'Jenkins LTS is several releases behind with open advisories', 'MEDIUM',   CURRENT_DATE-18, 5),
 ('Overly permissive IAM policy',          'Wildcard actions are granted to the developer role',          'HIGH',     CURRENT_DATE-5,  6),
 ('MFA not enabled for root account',      'Root user can sign in without multi factor authentication',   'HIGH',     CURRENT_DATE-11, 6),
 ('Outdated kernel patch level',           'VM is missing the last three kernel security patches',        'LOW',      CURRENT_DATE-3,  7),
 ('SSH management port exposed',           'Network security group exposes SSH to the internet',          'MEDIUM',   CURRENT_DATE-4,  7),
 ('SQL auditing disabled',                 'Audit logging is not enabled on the SQL server',              'MEDIUM',   CURRENT_DATE-8,  8),
 ('Database not encrypted with customer key','Transparent data encryption uses a service managed key',    'LOW',      CURRENT_DATE-2,  8),
 ('Blob container allows public access',   'Container access level is set to public',                     'HIGH',     CURRENT_DATE-10, 9),
 ('Dataset publicly shared',               'BigQuery dataset is granted to allUsers and is public',       'HIGH',     CURRENT_DATE-6,  10),
 ('Logging disabled on cluster',           'Cluster audit logging is turned off',                         'MEDIUM',   CURRENT_DATE-13, 11),
 ('Overly permissive service account',     'Function runs with the project editor role',                  'HIGH',     CURRENT_DATE-4,  12),
 ('Default service account in use',        'Workloads use the default compute service account',           'LOW',      CURRENT_DATE-1,  11);

INSERT INTO remediation(action_description, assigned_date, due_date, completed_date, status, vulnerability_id, assigned_user_id) VALUES
 ('Restrict SSH to the bastion CIDR range',            CURRENT_DATE-10, CURRENT_DATE+4,  NULL,            'IN_PROGRESS', 1, 2),
 ('Make bucket private and enable block public access',CURRENT_DATE-8,  CURRENT_DATE-2,  NULL,            'IN_PROGRESS', 3, 2),
 ('Enable SSE-KMS encryption on the bucket',           CURRENT_DATE-15, CURRENT_DATE-3,  CURRENT_DATE-4,  'COMPLETED',   4, 3),
 ('Rotate the default admin password',                 CURRENT_DATE-6,  CURRENT_DATE-1,  NULL,            'PENDING',     8, 3),
 ('Upgrade OpenSSL to the 3.x series',                 CURRENT_DATE-3,  CURRENT_DATE+10, NULL,            'PENDING',     2, 2),
 ('Enable database audit logging',                     CURRENT_DATE-20, CURRENT_DATE-10, CURRENT_DATE-11, 'COMPLETED',   6, 3),
 ('Replace IAM wildcards with scoped permissions',     CURRENT_DATE-5,  CURRENT_DATE+7,  NULL,            'IN_PROGRESS', 10, 3);

UPDATE vulnerability SET status = 'IN_PROGRESS'
 WHERE status = 'OPEN' AND vulnerability_id IN (SELECT vulnerability_id FROM remediation WHERE status <> 'COMPLETED');

INSERT INTO compliance_standard(standard_name, description) VALUES
 ('CIS Benchmarks', 'Center for Internet Security configuration benchmarks for cloud platforms'),
 ('ISO 27001',      'Information security management system controls'),
 ('PCI DSS',        'Payment card industry data security standard'),
 ('NIST 800-53',    'Security and privacy controls for information systems');

INSERT INTO compliance_rule(rule_name, description, severity, standard_id, match_keyword) VALUES
 ('Restrict public access to storage',   'No storage or dataset may be publicly readable',      'HIGH',     1, 'public'),
 ('Encrypt data at rest',                'All volumes and databases must be encrypted',          'HIGH',     1, 'encrypted'),
 ('Enable audit logging',                'Audit logging must be on for every data service',      'MEDIUM',   1, 'logging'),
 ('Disable default credentials',         'Vendor default accounts and passwords are not allowed','CRITICAL', 2, 'default'),
 ('Enforce least-privilege access',      'Permissions must be scoped to the minimum needed',     'HIGH',     2, 'permissive'),
 ('Restrict administrative ports',       'SSH and RDP must not be exposed to the internet',      'HIGH',     3, 'ssh'),
 ('Keep software patched',               'Packages with known CVEs must be upgraded',            'MEDIUM',   3, 'outdated'),
 ('Require multi-factor authentication', 'Privileged accounts must use MFA',                     'HIGH',     4, 'mfa'),
 ('Quarterly manual access review',      'Manual process, not automatically checked',            'LOW',      4, NULL);

-- run the stored function once for every resource so the compliance dashboard has data
SELECT fn_run_compliance_scan(resource_id) FROM cloud_resource ORDER BY resource_id;
