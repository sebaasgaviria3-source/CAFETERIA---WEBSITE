<?php
/**
 * Bloom Coffee & Brunch · panel de stock · JSON API
 * GET  ?action=state                → items, movements, categories, units
 * GET  ?action=export               → CSV download of the inventory
 * POST action=item.save             → create / update an item
 * POST action=item.archive          → archive / restore an item
 * POST action=move                  → stock movement (in / out / adjust)
 * Every request needs a logged-in session; every POST needs the CSRF token.
 */
declare(strict_types=1);
require __DIR__ . '/lib.php';

bloom_send_security_headers();
bloom_start_session();

function out(array $payload, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(string $msg, int $code = 400): void
{
    out(['ok' => false, 'error' => $msg], $code);
}

function num($v): ?float
{
    if (is_string($v)) {
        $v = str_replace(',', '.', trim($v));
    }
    if ($v === '' || $v === null || !is_numeric($v)) {
        return null;
    }
    $f = round((float) $v, 3);
    return is_finite($f) ? $f : null;
}

function clean(string $s, int $max): string
{
    $s = trim(preg_replace('/\s+/u', ' ', $s) ?? '');
    return mb_substr($s, 0, $max);
}

function public_state(array $inv): array
{
    $moves = array_slice(array_reverse($inv['movements']), 0, 300);
    return [
        'ok' => true,
        'items' => array_values($inv['items']),
        'movements' => $moves,
        'categories' => $inv['categories'],
        'units' => BLOOM_UNITS,
        'serverTime' => date('c'),
    ];
}

if (!bloom_is_configured() || !bloom_logged_in()) {
    fail('No autorizado.', 401);
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $method === 'GET' ? ($_GET['action'] ?? 'state') : '';

if ($method === 'GET' && $action === 'state') {
    out(public_state(bloom_inventory()));
}

if ($method === 'GET' && $action === 'export') {
    $inv = bloom_inventory();
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="bloom-stock-' . date('Y-m-d') . '.csv"');
    $fh = fopen('php://output', 'w');
    fwrite($fh, "\xEF\xBB\xBF"); // BOM so Excel reads UTF-8
    fputcsv($fh, ['Artículo', 'Categoría', 'Stock', 'Unidad', 'Mínimo', 'Estado', 'Archivado', 'Notas', 'Actualizado'], ';');
    foreach ($inv['items'] as $it) {
        $state = $it['qty'] <= 0 ? 'Agotado' : ($it['qty'] <= $it['min'] ? 'Stock bajo' : 'En stock');
        // neutralise spreadsheet formulas in user text
        $safe = fn ($s) => preg_match('/^[=+\-@]/', (string) $s) ? "'" . $s : $s;
        fputcsv($fh, [$safe($it['name']), $safe($it['category']), $it['qty'], $it['unit'], $it['min'], $state, $it['archived'] ? 'sí' : 'no', $safe($it['notes']), $it['updated']], ';');
    }
    fclose($fh);
    exit;
}

if ($method !== 'POST') {
    fail('Método no permitido.', 405);
}

$body = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($body)) {
    fail('Petición no válida.');
}
if (!bloom_check_csrf($body['csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null))) {
    fail('Sesión caducada. Recarga la página.', 403);
}
$action = (string) ($body['action'] ?? '');

$result = bloom_locked(function () use ($action, $body) {
    $inv = bloom_inventory();
    $now = date('c');

    if ($action === 'item.save') {
        $name = clean((string) ($body['name'] ?? ''), 80);
        $newCat = clean((string) ($body['newCategory'] ?? ''), 40);
        $category = $newCat !== '' ? $newCat : clean((string) ($body['category'] ?? ''), 40);
        $unit = (string) ($body['unit'] ?? '');
        $min = num($body['min'] ?? null);
        $notes = clean((string) ($body['notes'] ?? ''), 300);
        if ($name === '') return 'Escribe el nombre del artículo.';
        if ($category === '') return 'Elige o crea una categoría.';
        if (!in_array($unit, BLOOM_UNITS, true)) return 'Elige una unidad válida.';
        if ($min === null || $min < 0) return 'El stock mínimo debe ser un número igual o mayor que 0.';
        if (!in_array($category, $inv['categories'], true)) {
            $inv['categories'][] = $category;
        }
        $id = (int) ($body['id'] ?? 0);
        if ($id > 0) {
            if (!isset($inv['items'][$id])) return 'Ese artículo ya no existe.';
            foreach ($inv['items'] as $other) {
                if ($other['id'] !== $id && mb_strtolower($other['name']) === mb_strtolower($name) && !$other['archived']) return 'Ya existe un artículo con ese nombre.';
            }
            $inv['items'][$id] = array_merge($inv['items'][$id], compact('name', 'category', 'unit', 'min', 'notes') + ['updated' => $now]);
        } else {
            foreach ($inv['items'] as $other) {
                if (mb_strtolower($other['name']) === mb_strtolower($name) && !$other['archived']) return 'Ya existe un artículo con ese nombre.';
            }
            $qty = num($body['qty'] ?? 0) ?? 0.0;
            if ($qty < 0) return 'El stock inicial no puede ser negativo.';
            $id = $inv['nextId']++;
            $inv['items'][$id] = ['id' => $id, 'name' => $name, 'category' => $category, 'unit' => $unit, 'qty' => $qty, 'min' => $min, 'notes' => $notes, 'archived' => false, 'created' => $now, 'updated' => $now];
            if ($qty > 0) {
                $inv['movements'][] = ['id' => $inv['nextMove']++, 'itemId' => $id, 'item' => $name, 'unit' => $unit, 'type' => 'in', 'qty' => $qty, 'after' => $qty, 'note' => 'Stock inicial', 'at' => $now];
            }
        }
    } elseif ($action === 'item.archive') {
        $id = (int) ($body['id'] ?? 0);
        if (!isset($inv['items'][$id])) return 'Ese artículo ya no existe.';
        $inv['items'][$id]['archived'] = (bool) ($body['archived'] ?? true);
        $inv['items'][$id]['updated'] = $now;
    } elseif ($action === 'move') {
        $id = (int) ($body['id'] ?? 0);
        $type = (string) ($body['type'] ?? '');
        $qty = num($body['qty'] ?? null);
        $note = clean((string) ($body['note'] ?? ''), 140);
        if (!isset($inv['items'][$id])) return 'Ese artículo ya no existe.';
        if (!in_array($type, ['in', 'out', 'adjust'], true)) return 'Tipo de movimiento no válido.';
        if ($qty === null || $qty < 0 || ($type !== 'adjust' && $qty == 0)) return 'Escribe una cantidad mayor que 0.';
        $item = &$inv['items'][$id];
        if ($type === 'out' && $qty > $item['qty']) return 'No puedes sacar más de lo que hay (' . rtrim(rtrim(number_format($item['qty'], 3, ',', ''), '0'), ',') . ' ' . $item['unit'] . ').';
        $before = (float) $item['qty'];
        $after = $type === 'in' ? $before + $qty : ($type === 'out' ? $before - $qty : $qty);
        $item['qty'] = round($after, 3);
        $item['updated'] = $now;
        $delta = $type === 'adjust' ? round($after - $before, 3) : $qty;
        $inv['movements'][] = ['id' => $inv['nextMove']++, 'itemId' => $id, 'item' => $item['name'], 'unit' => $item['unit'], 'type' => $type, 'qty' => $delta, 'after' => $item['qty'], 'note' => $note, 'at' => $now];
        unset($item);
    } else {
        return 'Acción desconocida.';
    }

    // keep the history bounded (most recent 5000 movements)
    if (count($inv['movements']) > 5000) {
        $inv['movements'] = array_slice($inv['movements'], -5000);
    }
    bloom_write('inventory', $inv);
    return $inv;
});

if (is_string($result)) {
    fail($result, 422);
}
out(public_state($result));
