<?php
/**
 * Bloom Coffee & Brunch · panel de stock
 * Shared helpers: storage, sessions, auth, CSRF.
 *
 * Data lives in admin/data/*.php files. Each file starts with a PHP guard
 * line, so even if a server ignored .htaccess the file would execute and
 * print nothing instead of exposing the JSON.
 */
declare(strict_types=1);

const BLOOM_GUARD = "<?php http_response_code(404); exit; ?>\n";
const BLOOM_MAX_ATTEMPTS = 5;          // failed logins allowed…
const BLOOM_LOCK_WINDOW = 15 * 60;     // …within this many seconds
const BLOOM_SESSION_IDLE = 8 * 3600;   // log out after 8 h without activity

const BLOOM_UNITS = ['unidades', 'kg', 'g', 'litros', 'ml', 'paquetes', 'cajas'];
const BLOOM_DEFAULT_CATEGORIES = [
    'Café en grano',
    'Lácteos y bebidas vegetales',
    'Panadería y masas',
    'Frutas',
    'Bebidas',
    'Packaging',
    'Otros',
];

function bloom_data_dir(): string
{
    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) {
        mkdir($dir, 0750, true);
    }
    return $dir;
}

function bloom_read(string $name, array $default): array
{
    $file = bloom_data_dir() . "/$name.php";
    if (!is_file($file)) {
        return $default;
    }
    $raw = (string) file_get_contents($file);
    $json = substr($raw, strlen(BLOOM_GUARD));
    $data = json_decode($json, true);
    return is_array($data) ? $data : $default;
}

/** Atomic write: temp file + rename, under an exclusive lock. */
function bloom_write(string $name, array $data): void
{
    $dir = bloom_data_dir();
    $file = "$dir/$name.php";
    $tmp = "$file." . bin2hex(random_bytes(4)) . '.tmp';
    $payload = BLOOM_GUARD . json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if (file_put_contents($tmp, $payload, LOCK_EX) === false) {
        throw new RuntimeException('No se pudo guardar.');
    }
    chmod($tmp, 0640);
    rename($tmp, $file);
}

/** Run $fn with an exclusive lock on the data set so concurrent requests can't interleave. */
function bloom_locked(callable $fn)
{
    $lock = fopen(bloom_data_dir() . '/.lock', 'c');
    flock($lock, LOCK_EX);
    try {
        return $fn();
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

function bloom_start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_name('bloom_admin');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => dirname($_SERVER['SCRIPT_NAME']) . '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
    if (!empty($_SESSION['uid']) && (time() - (int) ($_SESSION['seen'] ?? 0)) > BLOOM_SESSION_IDLE) {
        $_SESSION = [];
        session_regenerate_id(true);
    }
    $_SESSION['seen'] = time();
}

function bloom_send_security_headers(): void
{
    header('X-Frame-Options: DENY');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    header('X-Robots-Tag: noindex, nofollow');
    header("Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    header('Cache-Control: no-store');
}

function bloom_auth(): array
{
    return bloom_read('auth', []);
}

function bloom_is_configured(): bool
{
    return !empty(bloom_auth()['hash']);
}

function bloom_logged_in(): bool
{
    return !empty($_SESSION['uid']);
}

function bloom_csrf(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function bloom_check_csrf(?string $token): bool
{
    return is_string($token) && !empty($_SESSION['csrf']) && hash_equals($_SESSION['csrf'], $token);
}

function bloom_client_key(): string
{
    return hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown');
}

function bloom_locked_out(): int
{
    $log = bloom_read('attempts', []);
    $key = bloom_client_key();
    $recent = array_filter($log[$key] ?? [], fn ($t) => $t > time() - BLOOM_LOCK_WINDOW);
    if (count($recent) < BLOOM_MAX_ATTEMPTS) {
        return 0;
    }
    return (int) (min($recent) + BLOOM_LOCK_WINDOW - time());
}

function bloom_record_failure(): void
{
    bloom_locked(function () {
        $log = bloom_read('attempts', []);
        $key = bloom_client_key();
        $log[$key] = array_values(array_filter($log[$key] ?? [], fn ($t) => $t > time() - BLOOM_LOCK_WINDOW));
        $log[$key][] = time();
        bloom_write('attempts', $log);
    });
}

function bloom_clear_failures(): void
{
    bloom_locked(function () {
        $log = bloom_read('attempts', []);
        unset($log[bloom_client_key()]);
        bloom_write('attempts', $log);
    });
}

function h(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function bloom_inventory(): array
{
    $inv = bloom_read('inventory', []);
    $inv += ['items' => [], 'movements' => [], 'categories' => BLOOM_DEFAULT_CATEGORIES, 'nextId' => 1, 'nextMove' => 1];
    return $inv;
}
