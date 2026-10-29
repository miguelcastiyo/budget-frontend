<?php
if (getenv('PRIVACY_PARITY_TEST') !== '1' || !str_contains((string)getenv('DB_DSN'), 'dbname=budget_privacy_parity_test;')) exit(2);
require getcwd() . '/../budget-backend/src/bootstrap.php';
$pdo = new PDO(getenv('DB_DSN'), getenv('DB_USER'), getenv('DB_PASS'), [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$userId = (int)getenv('TEST_USER_ID');
if (getenv('TEST_ACTION') === 'audit') {
    $columns = $pdo->query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'")->fetchAll(PDO::FETCH_COLUMN);
    foreach ($columns as $table) {
        if (!preg_match('/^[a-z0-9_]+$/', $table)) throw new RuntimeException('Invalid table name');
        $stmt = $pdo->query("SELECT * FROM `{$table}`");
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) foreach ($row as $value) {
            if (is_string($value) && str_contains($value, 'PHASE35_SECRET_')) throw new RuntimeException("Plaintext marker found in {$table}");
        }
    }
    $recordQuery = $pdo->prepare('SELECT is_deleted, ciphertext FROM encrypted_financial_records WHERE user_id = ? AND record_id = ?');
    foreach (['TEST_PENDING_ID', 'TEST_TRANSACTION_ID', 'TEST_LEDGER_ID'] as $name) {
        $recordQuery->execute([$userId, getenv($name)]); $row = $recordQuery->fetch();
        if (!$row || (int)$row['is_deleted'] !== 1 || $row['ciphertext'] !== null) throw new RuntimeException("Missing tombstone for {$name}");
    }
    $recordQuery->execute([$userId, getenv('TEST_RESTORED_ID')]); $row = $recordQuery->fetch();
    if (!$row || (int)$row['is_deleted'] !== 0 || $row['ciphertext'] === null) throw new RuntimeException('Restored pending record is missing');
    echo "Plaintext storage and tombstone audit passed\n";
    exit(0);
}
$vaults = new App\Privacy\VaultRepository($pdo);
$vaults->create($userId, 'vault_phase35_' . $userId, ['crypto_profile_version'=>1,'passphrase_kdf'=>'PBKDF2','passphrase_kdf_hash'=>'SHA-256','passphrase_kdf_iterations'=>600000,'passphrase_wrap_algorithm'=>'AES-KW','passphrase_kdf_salt'=>str_repeat('s',32),'passphrase_wrapped_vault_key'=>str_repeat('p',40),'recovery_wrap_algorithm'=>'AES-KW','recovery_wrapped_vault_key'=>str_repeat('r',40)]);
$pdo->prepare("UPDATE users SET financial_privacy_state='encrypted' WHERE id=?")->execute([$userId]);
