-- Bitget等、パスフレーズを必要とする取引所のため
ALTER TABLE exchange_connections ADD COLUMN api_passphrase_encrypted TEXT;
