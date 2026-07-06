-- MySQL dump 10.13  Distrib 8.0.45, for macos15 (arm64)
--
-- Host: 127.0.0.1    Database: farmacia_db
-- ------------------------------------------------------
-- Server version	8.4.8

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `branch_products`
--

DROP TABLE IF EXISTS `branch_products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `branch_products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `branch_id` int NOT NULL,
  `product_id` int NOT NULL,
  `sale_price` decimal(10,2) DEFAULT NULL,
  `cost_price_default` decimal(10,2) DEFAULT NULL,
  `current_stock` decimal(10,2) NOT NULL DEFAULT '0.00',
  `reserved_stock` decimal(10,2) NOT NULL DEFAULT '0.00',
  `shelf_location` varchar(150) DEFAULT NULL,
  `is_sellable` tinyint(1) NOT NULL DEFAULT '0',
  `is_visible_in_pos` tinyint(1) NOT NULL DEFAULT '0',
  `min_stock` decimal(10,2) NOT NULL DEFAULT '0.00',
  `max_stock` decimal(10,2) NOT NULL DEFAULT '0.00',
  `reorder_point` decimal(10,2) NOT NULL DEFAULT '0.00',
  `status` enum('active','inactive') DEFAULT 'active',
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_branch_product` (`branch_id`,`product_id`),
  KEY `product_id` (`product_id`),
  KEY `created_by` (`created_by`),
  KEY `updated_by` (`updated_by`),
  CONSTRAINT `branch_products_ibfk_1` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `branch_products_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `branch_products_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `branch_products_ibfk_4` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `branch_products`
--

LOCK TABLES `branch_products` WRITE;
/*!40000 ALTER TABLE `branch_products` DISABLE KEYS */;
INSERT INTO `branch_products` VALUES (1,1,1,0.25,0.15,382.00,0.00,'A1-03',1,1,10.00,200.00,25.00,'active',2,2,'2026-04-22 17:44:43','2026-05-05 18:13:56'),(2,1,2,15.00,10.00,296.00,0.00,'A1-04',1,1,40.00,300.00,20.00,'active',2,2,'2026-05-05 17:04:06','2026-05-05 18:13:56'),(3,1,3,100.00,30.00,10.00,0.00,'A1-05',1,1,5.00,10.00,3.00,'active',2,2,'2026-07-05 03:20:32','2026-07-05 03:21:38');
/*!40000 ALTER TABLE `branch_products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `branches`
--

DROP TABLE IF EXISTS `branches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `branches` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pharmacy_id` int NOT NULL,
  `code` varchar(100) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `address` text,
  `city` varchar(150) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `is_main` tinyint(1) NOT NULL DEFAULT '0',
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_branch_code_per_pharmacy` (`pharmacy_id`,`code`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `branches_ibfk_1` FOREIGN KEY (`pharmacy_id`) REFERENCES `pharmacies` (`id`),
  CONSTRAINT `branches_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `branches`
--

LOCK TABLES `branches` WRITE;
/*!40000 ALTER TABLE `branches` DISABLE KEYS */;
INSERT INTO `branches` VALUES (1,1,'SUC-01','Central','Barrio Georgino andrade','Managua','989898','correo@gmail.com','active',1,2,2,'2026-04-22 16:04:27','2026-04-22 16:04:27'),(2,1,'SUC-02','Sucursal Ivan Montenegro','Ivan Montenegro','Managua','87878787','correo@gmail.com','active',0,2,2,'2026-05-05 17:27:45','2026-05-05 17:27:45');
/*!40000 ALTER TABLE `branches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `clients`
--

DROP TABLE IF EXISTS `clients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clients` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pharmacy_id` int NOT NULL,
  `first_name` varchar(120) NOT NULL,
  `last_name` varchar(120) DEFAULT NULL,
  `document_number` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `address` text,
  `notes` text,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_clients_pharmacy_document` (`pharmacy_id`,`document_number`),
  UNIQUE KEY `uk_clients_pharmacy_email` (`pharmacy_id`,`email`),
  KEY `idx_clients_pharmacy_status_name` (`pharmacy_id`,`status`,`first_name`,`last_name`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clients`
--

LOCK TABLES `clients` WRITE;
/*!40000 ALTER TABLE `clients` DISABLE KEYS */;
INSERT INTO `clients` VALUES (1,1,'Consumidor','Final','176005445',NULL,NULL,NULL,NULL,'active',2,2,'2026-05-05 21:18:30','2026-05-05 21:19:52'),(2,1,'Mauricio','Ruiz','3232323','3232323','corre@gmail.com','Av naciones',NULL,'active',2,2,'2026-05-05 21:25:25','2026-05-05 21:25:25');
/*!40000 ALTER TABLE `clients` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_lots`
--

DROP TABLE IF EXISTS `inventory_lots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_lots` (
  `id` int NOT NULL AUTO_INCREMENT,
  `branch_product_id` int NOT NULL,
  `lot_number` varchar(100) NOT NULL,
  `purchase_price` decimal(10,2) DEFAULT NULL,
  `current_quantity` decimal(10,2) NOT NULL DEFAULT '0.00',
  `initial_quantity` decimal(10,2) NOT NULL,
  `expiration_date` date DEFAULT NULL,
  `received_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `supplier_name` varchar(255) DEFAULT NULL,
  `invoice_reference` varchar(150) DEFAULT NULL,
  `status` enum('active','depleted','expired') DEFAULT 'active',
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_lot_branch_product` (`branch_product_id`,`lot_number`),
  KEY `created_by` (`created_by`),
  KEY `updated_by` (`updated_by`),
  CONSTRAINT `inventory_lots_ibfk_1` FOREIGN KEY (`branch_product_id`) REFERENCES `branch_products` (`id`),
  CONSTRAINT `inventory_lots_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `inventory_lots_ibfk_3` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_lots`
--

LOCK TABLES `inventory_lots` WRITE;
/*!40000 ALTER TABLE `inventory_lots` DISABLE KEYS */;
INSERT INTO `inventory_lots` VALUES (4,1,'LOT-342323',2.00,182.00,200.00,'2026-05-10','2026-04-22 05:00:00','Distribuidor','Fact-00001','active',2,2,'2026-04-22 20:47:50','2026-05-05 18:13:56'),(5,1,'LOT-342324',40.00,100.00,100.00,'2026-06-03','2026-05-05 05:00:00','Distribuidor','Fact-00002','active',2,2,'2026-05-05 17:00:14','2026-05-05 17:00:14'),(6,2,'LOT-2026-05',15.00,296.00,300.00,'2026-05-29','2026-05-05 05:00:00','Digna','Fac 01','active',2,2,'2026-05-05 17:04:39','2026-05-05 18:13:56'),(7,3,'LOT-342323',20.00,10.00,10.00,'2026-10-31','2026-07-04 05:00:00','Distribuidor','Fact-00003','active',2,2,'2026-07-05 03:21:38','2026-07-05 03:21:38');
/*!40000 ALTER TABLE `inventory_lots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_movements`
--

DROP TABLE IF EXISTS `inventory_movements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_movements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `branch_product_id` int DEFAULT NULL,
  `inventory_lot_id` int NOT NULL,
  `movement_type` enum('initial_load','sale','in','out','adjustment') NOT NULL,
  `reference_type` varchar(50) DEFAULT NULL,
  `reference_id` int DEFAULT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `previous_stock` decimal(10,2) DEFAULT NULL,
  `new_stock` decimal(10,2) DEFAULT NULL,
  `unit_cost` decimal(10,2) DEFAULT NULL,
  `unit_price` decimal(10,2) DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `moved_by` int DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `inventory_lot_id` (`inventory_lot_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `inventory_movements_ibfk_1` FOREIGN KEY (`inventory_lot_id`) REFERENCES `inventory_lots` (`id`),
  CONSTRAINT `inventory_movements_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_movements`
--

LOCK TABLES `inventory_movements` WRITE;
/*!40000 ALTER TABLE `inventory_movements` DISABLE KEYS */;
INSERT INTO `inventory_movements` VALUES (1,1,4,'in','invoice',NULL,200.00,100.00,300.00,2.00,NULL,'Ingreso 1',NULL,2,NULL,'2026-04-22 20:47:50'),(2,1,5,'in','invoice',NULL,100.00,300.00,400.00,40.00,NULL,'entrada de 40',NULL,2,NULL,'2026-05-05 17:00:14'),(3,2,6,'initial_load','system',NULL,300.00,0.00,300.00,15.00,NULL,'Carga inicial de inventario',NULL,2,NULL,'2026-05-05 17:04:39'),(4,1,4,'sale','sale',1,-10.00,400.00,390.00,NULL,0.25,'Venta POS-1-20260505-0001',NULL,2,2,'2026-05-05 17:24:28'),(5,1,4,'sale','sale',2,-5.00,390.00,385.00,NULL,0.25,'Venta POS-1-20260505-0002',NULL,2,2,'2026-05-05 17:25:56'),(6,2,6,'sale','sale',2,-1.00,300.00,299.00,NULL,15.00,'Venta POS-1-20260505-0002',NULL,2,2,'2026-05-05 17:25:56'),(7,2,6,'sale','sale',3,-3.00,299.00,296.00,NULL,15.00,'Venta POS-1-20260505-0003',NULL,2,2,'2026-05-05 18:13:56'),(8,1,4,'sale','sale',3,-3.00,385.00,382.00,NULL,0.25,'Venta POS-1-20260505-0003',NULL,2,2,'2026-05-05 18:13:56'),(9,3,7,'in','invoice',NULL,10.00,0.00,10.00,20.00,NULL,'Notas',NULL,2,NULL,'2026-07-05 03:21:38');
/*!40000 ALTER TABLE `inventory_movements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pharmacies`
--

DROP TABLE IF EXISTS `pharmacies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pharmacies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `legal_name` varchar(255) DEFAULT NULL,
  `tax_id` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `address` text,
  `city` varchar(150) DEFAULT NULL,
  `country` varchar(150) DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_pharmacy_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pharmacies`
--

LOCK TABLES `pharmacies` WRITE;
/*!40000 ALTER TABLE `pharmacies` DISABLE KEYS */;
INSERT INTO `pharmacies` VALUES (1,'Farmacia Central','Farmacia Central S.A.','0999999999001','+593999999999','central@farmacia.com','Av. Principal 200','Managua','Nicaragua','active',1,2,'2026-03-30 21:51:25','2026-03-31 18:03:59');
/*!40000 ALTER TABLE `pharmacies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_categories`
--

DROP TABLE IF EXISTS `product_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pharmacy_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_category_name_per_pharmacy` (`pharmacy_id`,`name`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `product_categories_ibfk_1` FOREIGN KEY (`pharmacy_id`) REFERENCES `pharmacies` (`id`),
  CONSTRAINT `product_categories_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_categories`
--

LOCK TABLES `product_categories` WRITE;
/*!40000 ALTER TABLE `product_categories` DISABLE KEYS */;
INSERT INTO `product_categories` VALUES (1,1,'Analgésicos','paracetamol, ibuprofeno','active',2,2,'2026-04-22 17:25:14','2026-04-22 17:25:14'),(2,1,'Antibióticos','Antibióticos','active',2,2,'2026-04-22 17:25:28','2026-04-22 17:25:28'),(3,1,'Antiinflamatorios','Antiinflamatorios','active',2,2,'2026-04-22 17:25:42','2026-04-22 17:25:42'),(4,1,'Antialérgicos','Antialérgicos','active',2,2,'2026-04-22 17:25:49','2026-04-22 17:25:49'),(5,1,'Antigripales','Antigripales','active',2,2,'2026-04-22 17:25:55','2026-04-22 17:25:55');
/*!40000 ALTER TABLE `product_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pharmacy_id` int NOT NULL,
  `category_id` int DEFAULT NULL,
  `sku` varchar(100) NOT NULL,
  `barcode` varchar(100) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `generic_name` varchar(255) DEFAULT NULL,
  `description` text,
  `brand` varchar(255) DEFAULT NULL,
  `pharmaceutical_form` varchar(100) DEFAULT NULL,
  `presentation` varchar(100) DEFAULT NULL,
  `concentration` varchar(100) DEFAULT NULL,
  `unit_of_measure` varchar(50) DEFAULT NULL,
  `requires_prescription` tinyint(1) DEFAULT '0',
  `is_controlled_substance` tinyint(1) DEFAULT '0',
  `tax_rate` decimal(5,2) DEFAULT '0.00',
  `status` enum('active','inactive') DEFAULT 'active',
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_sku_pharmacy` (`pharmacy_id`,`sku`),
  KEY `category_id` (`category_id`),
  KEY `created_by` (`created_by`),
  KEY `updated_by` (`updated_by`),
  CONSTRAINT `products_ibfk_1` FOREIGN KEY (`pharmacy_id`) REFERENCES `pharmacies` (`id`),
  CONSTRAINT `products_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `product_categories` (`id`),
  CONSTRAINT `products_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `products_ibfk_4` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (1,1,1,'PARA-500-TAB','7861234567890','Paracetamol 500 mg','Paracetamol','Tabletas para dolor y fiebre','Genérico','Tableta','Caja x 20 tabletas','500 mg','unidad',0,0,15.00,'active',2,2,'2026-04-22 17:29:22','2026-05-05 17:25:17'),(2,1,1,'MED-PAR-500','7701234560001','Ibuprofeno 400 mg','Ibuprofeno','Analgésico y antipirético utilizado para aliviar dolor leve a moderado y fiebre.','Genérico','Tableta','Caja con 20 tabletas','400 mg','unidad',0,0,0.00,'active',2,2,'2026-05-05 17:03:00','2026-07-05 03:17:33'),(3,1,NULL,'MAG-232323','34343434','Magnum Jarabe','Magnum Jarabe','xxxxx','Genérico','Jarabe','Frasco 360 ML','360 miligramos','unidad',0,0,0.00,'active',2,2,'2026-07-05 03:20:01','2026-07-05 03:20:01');
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `code` varchar(50) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'Super Admin','SUPER_ADMIN','2026-03-30 21:13:15','2026-03-30 21:13:15'),(2,'Pharmacy Admin','PHARMACY_ADMIN','2026-03-30 21:13:15','2026-03-30 21:13:15'),(3,'Branch Admin','BRANCH_ADMIN','2026-03-30 21:13:15','2026-03-30 21:13:15'),(4,'Cashier','CASHIER','2026-03-30 21:13:15','2026-03-30 21:13:15');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sale_detail_lots`
--

DROP TABLE IF EXISTS `sale_detail_lots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sale_detail_lots` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sale_detail_id` int NOT NULL,
  `inventory_lot_id` int NOT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `unit_cost` decimal(10,2) DEFAULT NULL,
  `expiration_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `sale_detail_id` (`sale_detail_id`),
  KEY `inventory_lot_id` (`inventory_lot_id`),
  CONSTRAINT `sale_detail_lots_ibfk_1` FOREIGN KEY (`sale_detail_id`) REFERENCES `sale_details` (`id`),
  CONSTRAINT `sale_detail_lots_ibfk_2` FOREIGN KEY (`inventory_lot_id`) REFERENCES `inventory_lots` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sale_detail_lots`
--

LOCK TABLES `sale_detail_lots` WRITE;
/*!40000 ALTER TABLE `sale_detail_lots` DISABLE KEYS */;
INSERT INTO `sale_detail_lots` VALUES (1,1,4,10.00,2.00,'2026-05-10','2026-05-05 17:24:28'),(2,2,4,5.00,2.00,'2026-05-10','2026-05-05 17:25:56'),(3,3,6,1.00,15.00,'2026-05-29','2026-05-05 17:25:56'),(4,4,6,3.00,15.00,'2026-05-29','2026-05-05 18:13:56'),(5,5,4,3.00,2.00,'2026-05-10','2026-05-05 18:13:56');
/*!40000 ALTER TABLE `sale_detail_lots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sale_details`
--

DROP TABLE IF EXISTS `sale_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sale_details` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sale_id` int NOT NULL,
  `branch_product_id` int NOT NULL,
  `product_id` int DEFAULT NULL,
  `product_name` varchar(255) DEFAULT NULL,
  `sku` varchar(100) DEFAULT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `discount_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `tax_rate` decimal(5,2) NOT NULL DEFAULT '0.00',
  `tax_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `line_total` decimal(12,2) DEFAULT NULL,
  `requires_prescription` tinyint(1) NOT NULL DEFAULT '0',
  `total_price` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `sale_id` (`sale_id`),
  KEY `branch_product_id` (`branch_product_id`),
  CONSTRAINT `sale_details_ibfk_1` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`),
  CONSTRAINT `sale_details_ibfk_2` FOREIGN KEY (`branch_product_id`) REFERENCES `branch_products` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sale_details`
--

LOCK TABLES `sale_details` WRITE;
/*!40000 ALTER TABLE `sale_details` DISABLE KEYS */;
INSERT INTO `sale_details` VALUES (1,1,1,1,'Paracetamol 500 mg','PARA-500-TAB',10.00,0.25,0.00,0.00,0.00,2.50,0,2.50,'2026-05-05 17:24:28'),(2,2,1,1,'Paracetamol 500 mg','PARA-500-TAB',5.00,0.25,0.00,15.00,0.19,1.44,0,1.44,'2026-05-05 17:25:56'),(3,2,2,2,'Ibuprofeno 400 mg','MED-PAR-500',1.00,15.00,0.00,15.00,2.25,17.25,0,17.25,'2026-05-05 17:25:56'),(4,3,2,2,'Ibuprofeno 400 mg','MED-PAR-500',3.00,15.00,0.00,15.00,6.75,51.75,0,51.75,'2026-05-05 18:13:56'),(5,3,1,1,'Paracetamol 500 mg','PARA-500-TAB',3.00,0.25,0.00,15.00,0.11,0.86,0,0.86,'2026-05-05 18:13:56');
/*!40000 ALTER TABLE `sale_details` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales`
--

DROP TABLE IF EXISTS `sales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pharmacy_id` int DEFAULT NULL,
  `branch_id` int NOT NULL,
  `cashier_user_id` int DEFAULT NULL,
  `client_id` int DEFAULT NULL,
  `sale_number` varchar(50) DEFAULT NULL,
  `customer_name` varchar(255) DEFAULT NULL,
  `customer_document` varchar(100) DEFAULT NULL,
  `subtotal` decimal(12,2) DEFAULT NULL,
  `discount_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `discount_type` enum('percentage','amount') DEFAULT NULL,
  `discount_value` decimal(12,2) NOT NULL DEFAULT '0.00',
  `tax_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total` decimal(12,2) DEFAULT NULL,
  `payment_status` enum('pending','paid','partial','voided') NOT NULL DEFAULT 'paid',
  `sale_status` enum('pending','completed','cancelled') NOT NULL DEFAULT 'completed',
  `notes` text,
  `user_id` int NOT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `payment_method` enum('cash','card','transfer') NOT NULL DEFAULT 'cash',
  `status` enum('pending','completed','cancelled') DEFAULT 'pending',
  `sequence_number` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_branch_sequence` (`branch_id`,`sequence_number`),
  UNIQUE KEY `unique_sale_number` (`sale_number`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `sales_ibfk_1` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `sales_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales`
--

LOCK TABLES `sales` WRITE;
/*!40000 ALTER TABLE `sales` DISABLE KEYS */;
INSERT INTO `sales` VALUES (1,1,1,2,NULL,'POS-1-20260505-0001',NULL,NULL,2.50,0.00,NULL,0.00,0.00,2.50,'paid','completed',NULL,2,2.50,'cash','completed',1,'2026-05-05 17:24:28','2026-05-05 17:24:28'),(2,1,1,2,NULL,'POS-1-20260505-0002',NULL,NULL,16.25,0.00,NULL,0.00,2.44,18.69,'paid','completed',NULL,2,18.69,'cash','completed',2,'2026-05-05 17:25:56','2026-05-05 17:25:56'),(3,1,1,2,NULL,'POS-1-20260505-0003',NULL,NULL,45.75,0.00,NULL,0.00,6.86,52.61,'paid','completed',NULL,2,52.61,'cash','completed',3,'2026-05-05 18:13:56','2026-05-05 18:13:56');
/*!40000 ALTER TABLE `sales` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_branch_roles`
--

DROP TABLE IF EXISTS `user_branch_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_branch_roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `branch_id` int NOT NULL,
  `role_id` int DEFAULT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `status` enum('active','inactive') DEFAULT 'active',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_branch_role` (`user_id`,`branch_id`,`role_id`),
  KEY `created_by` (`created_by`),
  KEY `idx_user_branch_roles_user_id` (`user_id`),
  KEY `idx_user_branch_roles_branch_id` (`branch_id`),
  KEY `idx_user_branch_roles_role_id` (`role_id`),
  CONSTRAINT `user_branch_roles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `user_branch_roles_ibfk_2` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `user_branch_roles_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_branch_roles`
--

LOCK TABLES `user_branch_roles` WRITE;
/*!40000 ALTER TABLE `user_branch_roles` DISABLE KEYS */;
INSERT INTO `user_branch_roles` VALUES (1,2,1,3,0,'active',NULL,'2026-04-22 17:10:10','2026-04-22 17:10:10'),(2,3,1,4,1,'active',NULL,'2026-04-22 17:10:18','2026-04-22 17:10:18'),(3,4,1,4,0,'active',NULL,'2026-04-22 17:10:23','2026-04-22 17:10:23'),(4,2,2,3,0,'active',NULL,'2026-05-05 17:28:11','2026-05-05 17:28:11'),(5,3,2,4,0,'active',NULL,'2026-05-05 17:28:17','2026-05-05 17:28:17');
/*!40000 ALTER TABLE `user_branch_roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_pharmacy_roles`
--

DROP TABLE IF EXISTS `user_pharmacy_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_pharmacy_roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `pharmacy_id` int NOT NULL,
  `role_id` int NOT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_pharmacy_role` (`user_id`,`pharmacy_id`,`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_pharmacy_roles`
--

LOCK TABLES `user_pharmacy_roles` WRITE;
/*!40000 ALTER TABLE `user_pharmacy_roles` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_pharmacy_roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `pharmacy_id` int DEFAULT NULL,
  `role_id` int DEFAULT NULL,
  `is_super_admin` tinyint(1) DEFAULT '0',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_login_at` timestamp NULL DEFAULT NULL COMMENT 'Fecha y hora del último login del usuario',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `pharmacy_id` (`pharmacy_id`),
  KEY `role_id` (`role_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`pharmacy_id`) REFERENCES `pharmacies` (`id`),
  CONSTRAINT `users_ibfk_2` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`),
  CONSTRAINT `users_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Super','Admin','admin@farmacia.com','+1234567890','$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','active',NULL,1,1,NULL,'2026-03-30 21:34:48','2026-04-20 00:29:50','2026-04-20 00:29:50'),(2,'Lucia','Vargas','lucia.vargas@farmacia.com','+593999123456','$2b$10$6.DNEuhgrvkaAz2mtApEg.xoUASynQM1ZHoKQJY/NBimgjxrrYHvu','active',1,2,0,1,'2026-03-30 21:51:53','2026-07-05 03:29:13','2026-07-05 03:29:13'),(3,'Cajero','uno','cajerouno@farmacia.com','98984343','$2b$10$L9gzTTmUEnSFY6qlNGXrB.JM3wmdlv0IpKqeYAQja.LtfvoNZLDx.','active',1,3,0,2,'2026-04-20 15:29:17','2026-04-20 15:29:28',NULL),(4,'cajero','dos','cajerodos@farmacia.com','0999999999','$2b$10$OiVQnEcdl/Mk/vTR1Z.3qOI0YEPJxchPKyOT209nUr6NkdOFpiOh.','active',1,4,0,2,'2026-04-22 17:03:28','2026-07-05 03:26:50','2026-07-05 03:26:50');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-05 20:55:02
