-- The ESP32 reports its home-LAN address in each heartbeat so the customer
-- app can switch the water on and off over the home Wi-Fi.
ALTER TABLE "Device" ADD COLUMN "localIp" TEXT;
