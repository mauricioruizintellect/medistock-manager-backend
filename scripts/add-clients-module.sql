CREATE TABLE clients (
  id INT NOT NULL AUTO_INCREMENT,
  pharmacy_id INT NOT NULL,
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NULL,
  document_number VARCHAR(100) NULL,
  phone VARCHAR(20) NULL,
  email VARCHAR(255) NULL,
  address TEXT NULL,
  notes TEXT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_by INT NULL,
  updated_by INT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_clients_pharmacy_document (pharmacy_id, document_number),
  UNIQUE KEY uk_clients_pharmacy_email (pharmacy_id, email),
  KEY idx_clients_pharmacy_status_name (pharmacy_id, status, first_name, last_name)
);

ALTER TABLE sales
  ADD COLUMN client_id INT NULL AFTER cashier_user_id;
