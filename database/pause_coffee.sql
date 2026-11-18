-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Nov 18, 2026 at 04:57 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `pause_coffee`
--

-- --------------------------------------------------------

--
-- Table structure for table `audit_logs`
--

CREATE TABLE `audit_logs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `action` varchar(80) NOT NULL,
  `details` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `audit_logs`
--

INSERT INTO `audit_logs` (`id`, `user_id`, `action`, `details`, `created_at`) VALUES
(1, 1, 'user-save', 'Account #2', '2026-11-18 15:54:55');

-- --------------------------------------------------------

--
-- Table structure for table `ingredients`
--

CREATE TABLE `ingredients` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(140) NOT NULL,
  `unit` varchar(30) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ingredient_stock`
--

CREATE TABLE `ingredient_stock` (
  `ingredient_id` int(10) UNSIGNED NOT NULL,
  `quantity` decimal(14,3) NOT NULL DEFAULT 0.000,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ingredient_stock_movements`
--

CREATE TABLE `ingredient_stock_movements` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `ingredient_id` int(10) UNSIGNED NOT NULL,
  `shift_id` bigint(20) UNSIGNED DEFAULT NULL,
  `order_id` bigint(20) UNSIGNED DEFAULT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `movement_type` enum('Pre-Shift Count','Sale Deduction','Post-Shift Count','Count Correction') NOT NULL,
  `quantity_change` decimal(14,3) NOT NULL,
  `balance_after` decimal(14,3) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inventory_count_corrections`
--

CREATE TABLE `inventory_count_corrections` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `count_id` bigint(20) UNSIGNED NOT NULL,
  `previous_quantity` decimal(12,3) NOT NULL,
  `new_quantity` decimal(12,3) NOT NULL,
  `reason` varchar(500) NOT NULL,
  `corrected_by` int(10) UNSIGNED NOT NULL,
  `corrected_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inventory_entries`
--

CREATE TABLE `inventory_entries` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `ingredient` varchar(140) NOT NULL,
  `quantity` decimal(12,3) NOT NULL,
  `unit` varchar(30) NOT NULL,
  `shift_label` enum('Opening','Closing') NOT NULL,
  `record_date` date NOT NULL,
  `recorded_by` int(10) UNSIGNED NOT NULL,
  `updated_by` int(10) UNSIGNED DEFAULT NULL,
  `correction_reason` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inventory_handovers`
--

CREATE TABLE `inventory_handovers` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `outgoing_shift_id` bigint(20) UNSIGNED NOT NULL,
  `incoming_shift_id` bigint(20) UNSIGNED NOT NULL,
  `reviewed_by` int(10) UNSIGNED NOT NULL,
  `decision` enum('Approved','Flagged') NOT NULL,
  `note` varchar(500) DEFAULT NULL,
  `reviewed_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inventory_shifts`
--

CREATE TABLE `inventory_shifts` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `barista_id` int(10) UNSIGNED NOT NULL,
  `status` enum('In Progress','Submitted') NOT NULL DEFAULT 'In Progress',
  `started_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `ended_at` timestamp NULL DEFAULT NULL,
  `notes` varchar(500) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inventory_shift_counts`
--

CREATE TABLE `inventory_shift_counts` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `shift_id` bigint(20) UNSIGNED NOT NULL,
  `phase` enum('Pre-Shift','Post-Shift') NOT NULL,
  `ingredient` varchar(140) NOT NULL,
  `quantity` decimal(12,3) NOT NULL,
  `unit` varchar(30) NOT NULL,
  `recorded_by` int(10) UNSIGNED NOT NULL,
  `recorded_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `status` enum('Completed','Cancelled') NOT NULL DEFAULT 'Completed',
  `subtotal` decimal(12,2) NOT NULL,
  `total` decimal(12,2) NOT NULL,
  `refunded` decimal(12,2) NOT NULL DEFAULT 0.00,
  `payment_method` enum('Cash','Digital') NOT NULL,
  `amount_received` decimal(12,2) DEFAULT NULL,
  `change_due` decimal(12,2) DEFAULT NULL,
  `payment_reference` varchar(140) DEFAULT NULL,
  `shift_label` enum('Opening','Closing') NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_items`
--

CREATE TABLE `order_items` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `order_id` bigint(20) UNSIGNED NOT NULL,
  `product_id` int(10) UNSIGNED NOT NULL,
  `product_name` varchar(140) NOT NULL,
  `variation` varchar(80) NOT NULL DEFAULT '',
  `size` varchar(50) NOT NULL DEFAULT '',
  `unit_price` decimal(10,2) NOT NULL,
  `quantity` int(10) UNSIGNED NOT NULL,
  `line_total` decimal(12,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(140) NOT NULL,
  `category` varchar(80) NOT NULL,
  `variation` varchar(80) NOT NULL DEFAULT '',
  `size` varchar(50) NOT NULL DEFAULT '',
  `price` decimal(10,2) NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `products`
--

INSERT INTO `products` (`id`, `name`, `category`, `variation`, `size`, `price`, `active`, `created_at`) VALUES
(1, 'Iced Americano', 'Coffee', 'Classic', 'Regular', 100.00, 1, '2026-11-18 14:54:35'),
(2, 'Iced Matcha', 'Non-Coffee', 'Matcha', 'Regular', 150.00, 1, '2026-11-18 14:54:35'),
(3, 'Iced Latte', 'Coffee', 'Classic', 'Regular', 130.00, 1, '2026-11-18 14:54:35'),
(4, 'Spanish Latte', 'Coffee', 'Spanish', 'Regular', 145.00, 1, '2026-11-18 14:54:35'),
(5, 'Hot Americano', 'Coffee', 'Classic', 'Regular', 90.00, 1, '2026-11-18 14:54:35'),
(6, 'Iced Chocolate', 'Non-Coffee', 'Chocolate', 'Regular', 140.00, 1, '2026-11-18 14:54:35');

-- --------------------------------------------------------

--
-- Table structure for table `product_recipes`
--

CREATE TABLE `product_recipes` (
  `product_id` int(10) UNSIGNED NOT NULL,
  `ingredient_id` int(10) UNSIGNED NOT NULL,
  `quantity_per_item` decimal(12,3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `refunds`
--

CREATE TABLE `refunds` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `order_id` bigint(20) UNSIGNED NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `reason` varchar(500) NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(120) NOT NULL,
  `username` varchar(60) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('Owner','Barista') NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `username`, `password_hash`, `role`, `active`, `created_at`) VALUES
(1, 'Owner', 'Owner', '$2y$10$4S3n0d8qBihkefadZmK0BuwgFLxnmSFzlAfGf9yvKuIuh5grVEH0e', 'Owner', 1, '2026-11-18 14:54:35'),
(2, 'Mia', 'Barista', '$2y$10$S7jGYvbf8LKNe0Sn3pbJsOqVRroKs.N.gl/WPu3qr1er3TrSy4yh.', 'Barista', 1, '2026-11-18 15:54:55');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `ingredients`
--
ALTER TABLE `ingredients`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_ingredient_unit` (`name`,`unit`);

--
-- Indexes for table `ingredient_stock`
--
ALTER TABLE `ingredient_stock`
  ADD PRIMARY KEY (`ingredient_id`);

--
-- Indexes for table `ingredient_stock_movements`
--
ALTER TABLE `ingredient_stock_movements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `ingredient_id` (`ingredient_id`),
  ADD KEY `shift_id` (`shift_id`),
  ADD KEY `order_id` (`order_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `inventory_count_corrections`
--
ALTER TABLE `inventory_count_corrections`
  ADD PRIMARY KEY (`id`),
  ADD KEY `count_id` (`count_id`),
  ADD KEY `corrected_by` (`corrected_by`);

--
-- Indexes for table `inventory_entries`
--
ALTER TABLE `inventory_entries`
  ADD PRIMARY KEY (`id`),
  ADD KEY `recorded_by` (`recorded_by`),
  ADD KEY `updated_by` (`updated_by`);

--
-- Indexes for table `inventory_handovers`
--
ALTER TABLE `inventory_handovers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `outgoing_shift_id` (`outgoing_shift_id`),
  ADD UNIQUE KEY `incoming_shift_id` (`incoming_shift_id`),
  ADD KEY `reviewed_by` (`reviewed_by`);

--
-- Indexes for table `inventory_shifts`
--
ALTER TABLE `inventory_shifts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_shift_barista` (`barista_id`,`status`);

--
-- Indexes for table `inventory_shift_counts`
--
ALTER TABLE `inventory_shift_counts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_shift_phase_ingredient` (`shift_id`,`phase`,`ingredient`,`unit`),
  ADD KEY `recorded_by` (`recorded_by`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `order_items`
--
ALTER TABLE `order_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_id` (`order_id`),
  ADD KEY `product_id` (`product_id`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `product_recipes`
--
ALTER TABLE `product_recipes`
  ADD PRIMARY KEY (`product_id`,`ingredient_id`),
  ADD KEY `ingredient_id` (`ingredient_id`);

--
-- Indexes for table `refunds`
--
ALTER TABLE `refunds`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_id` (`order_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `audit_logs`
--
ALTER TABLE `audit_logs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `ingredients`
--
ALTER TABLE `ingredients`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `ingredient_stock_movements`
--
ALTER TABLE `ingredient_stock_movements`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `inventory_count_corrections`
--
ALTER TABLE `inventory_count_corrections`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `inventory_entries`
--
ALTER TABLE `inventory_entries`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `inventory_handovers`
--
ALTER TABLE `inventory_handovers`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `inventory_shifts`
--
ALTER TABLE `inventory_shifts`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `inventory_shift_counts`
--
ALTER TABLE `inventory_shift_counts`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `order_items`
--
ALTER TABLE `order_items`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `products`
--
ALTER TABLE `products`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `refunds`
--
ALTER TABLE `refunds`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD CONSTRAINT `audit_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `ingredient_stock`
--
ALTER TABLE `ingredient_stock`
  ADD CONSTRAINT `ingredient_stock_ibfk_1` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`);

--
-- Constraints for table `ingredient_stock_movements`
--
ALTER TABLE `ingredient_stock_movements`
  ADD CONSTRAINT `ingredient_stock_movements_ibfk_1` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`),
  ADD CONSTRAINT `ingredient_stock_movements_ibfk_2` FOREIGN KEY (`shift_id`) REFERENCES `inventory_shifts` (`id`),
  ADD CONSTRAINT `ingredient_stock_movements_ibfk_3` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  ADD CONSTRAINT `ingredient_stock_movements_ibfk_4` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `inventory_count_corrections`
--
ALTER TABLE `inventory_count_corrections`
  ADD CONSTRAINT `inventory_count_corrections_ibfk_1` FOREIGN KEY (`count_id`) REFERENCES `inventory_shift_counts` (`id`),
  ADD CONSTRAINT `inventory_count_corrections_ibfk_2` FOREIGN KEY (`corrected_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `inventory_entries`
--
ALTER TABLE `inventory_entries`
  ADD CONSTRAINT `inventory_entries_ibfk_1` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `inventory_entries_ibfk_2` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `inventory_handovers`
--
ALTER TABLE `inventory_handovers`
  ADD CONSTRAINT `inventory_handovers_ibfk_1` FOREIGN KEY (`outgoing_shift_id`) REFERENCES `inventory_shifts` (`id`),
  ADD CONSTRAINT `inventory_handovers_ibfk_2` FOREIGN KEY (`incoming_shift_id`) REFERENCES `inventory_shifts` (`id`),
  ADD CONSTRAINT `inventory_handovers_ibfk_3` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `inventory_shifts`
--
ALTER TABLE `inventory_shifts`
  ADD CONSTRAINT `inventory_shifts_ibfk_1` FOREIGN KEY (`barista_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `inventory_shift_counts`
--
ALTER TABLE `inventory_shift_counts`
  ADD CONSTRAINT `inventory_shift_counts_ibfk_1` FOREIGN KEY (`shift_id`) REFERENCES `inventory_shifts` (`id`),
  ADD CONSTRAINT `inventory_shift_counts_ibfk_2` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `order_items`
--
ALTER TABLE `order_items`
  ADD CONSTRAINT `order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  ADD CONSTRAINT `order_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

--
-- Constraints for table `product_recipes`
--
ALTER TABLE `product_recipes`
  ADD CONSTRAINT `product_recipes_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  ADD CONSTRAINT `product_recipes_ibfk_2` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`);

--
-- Constraints for table `refunds`
--
ALTER TABLE `refunds`
  ADD CONSTRAINT `refunds_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  ADD CONSTRAINT `refunds_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
