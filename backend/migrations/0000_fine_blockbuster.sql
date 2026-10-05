CREATE TABLE `brands` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brands_slug_unique` ON `brands` (`slug`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`position` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `product_attributes` (
	`product_id` text NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`value` text NOT NULL,
	`label` text NOT NULL,
	`unit` text,
	PRIMARY KEY(`product_id`, `key`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `product_attributes_filter_idx` ON `product_attributes` (`key`,`value`);--> statement-breakpoint
CREATE TABLE `product_images` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`url` text NOT NULL,
	`alt` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `product_images_product_idx` ON `product_images` (`product_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`short_description` text NOT NULL,
	`price_kopecks` integer NOT NULL,
	`category_id` text NOT NULL,
	`brand_id` text NOT NULL,
	`color_slug` text NOT NULL,
	`color_name` text NOT NULL,
	`color_hex` text NOT NULL,
	`material_slug` text NOT NULL,
	`material_name` text NOT NULL,
	`type_slug` text NOT NULL,
	`type_name` text NOT NULL,
	`availability` text NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`popularity` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`search_text` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "products_price_nonnegative" CHECK("products"."price_kopecks" >= 0),
	CONSTRAINT "products_availability_valid" CHECK("products"."availability" IN ('in_stock', 'out_of_stock'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_unique` ON `products` (`sku`);--> statement-breakpoint
CREATE INDEX `products_category_price_idx` ON `products` (`category_id`,`price_kopecks`);--> statement-breakpoint
CREATE INDEX `products_brand_idx` ON `products` (`brand_id`);--> statement-breakpoint
CREATE INDEX `products_price_idx` ON `products` (`price_kopecks`);