CREATE TABLE `commerce_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`order_id` text NOT NULL,
	`operation_id` text NOT NULL,
	`status` text NOT NULL,
	`outcome` text NOT NULL,
	`created_at` text NOT NULL,
	`ready_at` integer NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`order_id`) REFERENCES `commerce_orders`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "commerce_attempt_status" CHECK("commerce_attempts"."status" IN ('pending', 'processing', 'internal_succeeded', 'failed')),
	CONSTRAINT "commerce_attempt_outcome" CHECK("commerce_attempts"."outcome" IN ('internal_succeeded', 'failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `commerce_payment_intent` ON `commerce_attempts` (`owner`,`operation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `commerce_payment_active` ON `commerce_attempts` (`order_id`) WHERE "commerce_attempts"."status" != 'failed';--> statement-breakpoint
CREATE INDEX `commerce_payment_order` ON `commerce_attempts` (`order_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `commerce_carts` (
	`owner` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`version` integer NOT NULL,
	`snapshot` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `commerce_carts_id_unique` ON `commerce_carts` (`id`);--> statement-breakpoint
CREATE TABLE `commerce_links` (
	`code_hash` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`target` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `commerce_operations` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`snapshot` text NOT NULL,
	`applied` integer NOT NULL,
	PRIMARY KEY(`owner`, `id`),
	CONSTRAINT "commerce_cas_applied" CHECK("commerce_operations"."applied" = 1)
);
--> statement-breakpoint
CREATE TABLE `commerce_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`owner` text NOT NULL,
	`cart_version` integer NOT NULL,
	`quote_id` text NOT NULL,
	`operation_id` text NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` text NOT NULL,
	`payment_mode` text NOT NULL,
	`payment_status` text NOT NULL,
	`valid` integer NOT NULL,
	CONSTRAINT "commerce_order_valid" CHECK("commerce_orders"."valid" = 1),
	CONSTRAINT "commerce_payment_mode" CHECK("commerce_orders"."payment_mode" = 'internal_presentation')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `commerce_orders_number_unique` ON `commerce_orders` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `commerce_orders_quote_id_unique` ON `commerce_orders` (`quote_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `commerce_order_version` ON `commerce_orders` (`owner`,`cart_version`);--> statement-breakpoint
CREATE UNIQUE INDEX `commerce_order_intent` ON `commerce_orders` (`owner`,`operation_id`);--> statement-breakpoint
CREATE INDEX `commerce_order_owner` ON `commerce_orders` (`owner`,`created_at`);--> statement-breakpoint
CREATE TABLE `commerce_quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`cart_version` integer NOT NULL,
	`snapshot` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `commerce_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`expires_at` integer NOT NULL
);
