<?php
/**
 * Bloom Coffee & Brunch · panel privado de stock
 * First visit: create the admin password. Afterwards: login → inventory app.
 * To reset the password, delete admin/data/auth.php by FTP and visit again.
 */
declare(strict_types=1);
require __DIR__ . '/lib.php';

bloom_send_security_headers();
bloom_start_session();

$error = '';
$notice = '';
$configured = bloom_is_configured();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    if (!bloom_check_csrf($_POST['csrf'] ?? null)) {
        $error = 'La sesión ha caducado. Vuelve a intentarlo.';
    } elseif ($action === 'setup' && !$configured) {
        $p1 = (string) ($_POST['password'] ?? '');
        $p2 = (string) ($_POST['password2'] ?? '');
        if (mb_strlen($p1) < 10) {
            $error = 'La contraseña necesita al menos 10 caracteres.';
        } elseif ($p1 !== $p2) {
            $error = 'Las contraseñas no coinciden.';
        } else {
            $created = bloom_locked(function () use ($p1) {
                if (bloom_is_configured()) {
                    return false; // someone finished setup a moment earlier
                }
                bloom_write('auth', ['hash' => password_hash($p1, PASSWORD_DEFAULT), 'created' => date('c')]);
                return true;
            });
            if ($created) {
                session_regenerate_id(true);
                $_SESSION['uid'] = 'admin';
                header('Location: ./');
                exit;
            }
            $error = 'El panel ya estaba configurado. Inicia sesión.';
            $configured = true;
        }
    } elseif ($action === 'login' && $configured) {
        $wait = bloom_locked_out();
        if ($wait > 0) {
            $error = 'Demasiados intentos. Espera ' . ceil($wait / 60) . ' min.';
        } elseif (password_verify((string) ($_POST['password'] ?? ''), (string) bloom_auth()['hash'])) {
            bloom_clear_failures();
            session_regenerate_id(true);
            $_SESSION['uid'] = 'admin';
            unset($_SESSION['csrf']);
            header('Location: ./');
            exit;
        } else {
            bloom_record_failure();
            usleep(400000);
            $error = 'Contraseña incorrecta.';
        }
    } elseif ($action === 'logout') {
        $_SESSION = [];
        session_regenerate_id(true);
        $notice = 'Sesión cerrada.';
    }
}

$csrf = bloom_csrf();
$view = !$configured ? 'setup' : (bloom_logged_in() ? 'app' : 'login');
?><!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Stock · Bloom Coffee &amp; Brunch</title>
  <link rel="icon" href="../assets/img/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="../tokens.css?v=20261014">
  <link rel="stylesheet" href="admin.css?v=20261014">
</head>
<body class="view-<?= h($view) ?>">

<?php if ($view !== 'app'): ?>
  <main class="gate">
    <img class="gate__logo" src="../assets/img/logo-bloom-480.webp" alt="Bloom Coffee &amp; Brunch" width="480" height="308">
    <?php if ($view === 'setup'): ?>
      <h1>Crea la contraseña del panel</h1>
      <p>Primer acceso. Solo quien conozca esta contraseña podrá ver y editar el stock.</p>
    <?php else: ?>
      <h1>Panel de stock</h1>
      <p>Acceso solo para el equipo de Bloom.</p>
    <?php endif; ?>
    <?php if ($error): ?><p class="msg msg--error" role="alert"><?= h($error) ?></p><?php endif; ?>
    <?php if ($notice): ?><p class="msg" role="status"><?= h($notice) ?></p><?php endif; ?>
    <form method="post" class="gate__form" autocomplete="on">
      <input type="hidden" name="csrf" value="<?= h($csrf) ?>">
      <input type="hidden" name="action" value="<?= $view === 'setup' ? 'setup' : 'login' ?>">
      <label>Contraseña
        <input type="password" name="password" required minlength="<?= $view === 'setup' ? 10 : 1 ?>" autocomplete="<?= $view === 'setup' ? 'new-password' : 'current-password' ?>" autofocus>
      </label>
      <?php if ($view === 'setup'): ?>
        <label>Repite la contraseña
          <input type="password" name="password2" required minlength="10" autocomplete="new-password">
        </label>
      <?php endif; ?>
      <button class="btn btn--primary" type="submit"><?= $view === 'setup' ? 'Guardar y entrar' : 'Entrar' ?></button>
    </form>
    <a class="gate__back" href="../">Volver a la web</a>
  </main>

<?php else: ?>
  <header class="top">
    <a class="top__brand" href="./"><img src="../assets/img/logo-bloom-480.webp" alt="Bloom Coffee &amp; Brunch" width="480" height="308"><span>Stock</span></a>
    <div class="top__actions">
      <a class="btn btn--ghost" href="api.php?action=export" data-export>Exportar CSV</a>
      <form method="post">
        <input type="hidden" name="csrf" value="<?= h($csrf) ?>">
        <input type="hidden" name="action" value="logout">
        <button class="btn btn--ghost" type="submit">Cerrar sesión</button>
      </form>
    </div>
  </header>

  <main class="app" id="app" data-csrf="<?= h($csrf) ?>">
    <section class="kpis" aria-label="Resumen">
      <div class="kpi"><span class="kpi__label">Artículos activos</span><strong class="kpi__value" data-kpi="total">0</strong></div>
      <div class="kpi kpi--low"><span class="kpi__label">Stock bajo</span><strong class="kpi__value" data-kpi="low">0</strong></div>
      <div class="kpi kpi--out"><span class="kpi__label">Agotados / por reponer</span><strong class="kpi__value" data-kpi="out">0</strong></div>
    </section>

    <section class="panel" aria-labelledby="inv-title">
      <div class="panel__head">
        <h2 id="inv-title">Inventario</h2>
        <button class="btn btn--primary" data-new>Nuevo artículo</button>
      </div>
      <div class="filters">
        <label class="filters__search">
          <span class="sr">Buscar</span>
          <input type="search" placeholder="Buscar artículo…" data-filter="q">
        </label>
        <label><span class="sr">Categoría</span>
          <select data-filter="cat"><option value="">Todas las categorías</option></select>
        </label>
        <label><span class="sr">Estado</span>
          <select data-filter="status">
            <option value="">Todos los estados</option>
            <option value="ok">En stock</option>
            <option value="low">Stock bajo</option>
            <option value="out">Agotado</option>
            <option value="archived">Archivados</option>
          </select>
        </label>
      </div>
      <div class="table-wrap">
        <table class="inv">
          <thead><tr><th>Artículo</th><th>Categoría</th><th class="num">Stock</th><th class="num">Mínimo</th><th>Estado</th><th><span class="sr">Acciones</span></th></tr></thead>
          <tbody data-rows></tbody>
        </table>
        <p class="empty" data-empty hidden>No hay artículos que coincidan. Crea el primero con «Nuevo artículo».</p>
      </div>
    </section>

    <section class="panel" aria-labelledby="mov-title">
      <div class="panel__head">
        <h2 id="mov-title">Historial de movimientos</h2>
      </div>
      <div class="table-wrap">
        <table class="inv inv--moves">
          <thead><tr><th>Fecha</th><th>Artículo</th><th>Tipo</th><th class="num">Cantidad</th><th class="num">Stock tras</th><th>Nota</th></tr></thead>
          <tbody data-moves></tbody>
        </table>
        <p class="empty" data-moves-empty hidden>Aún no hay movimientos.</p>
      </div>
    </section>
  </main>

  <!-- Item form -->
  <dialog class="sheet" data-item-dialog aria-labelledby="item-title">
    <form method="dialog" class="sheet__form" data-item-form novalidate>
      <h2 id="item-title" data-item-title>Nuevo artículo</h2>
      <input type="hidden" name="id">
      <label>Nombre<input name="name" required maxlength="80"></label>
      <div class="row2">
        <label>Categoría<select name="category" required></select></label>
        <label>Nueva categoría (opcional)<input name="newCategory" maxlength="40" placeholder="Escribe para crearla"></label>
      </div>
      <div class="row3">
        <label>Unidad<select name="unit" required></select></label>
        <label data-initial>Stock inicial<input name="qty" type="text" inputmode="decimal" pattern="[0-9]+([.,][0-9]{1,3})?" autocomplete="off" value="0"></label>
        <label>Stock mínimo<input name="min" type="text" inputmode="decimal" pattern="[0-9]+([.,][0-9]{1,3})?" autocomplete="off" value="0" required></label>
      </div>
      <label>Notas<textarea name="notes" rows="2" maxlength="300"></textarea></label>
      <p class="msg msg--error" data-item-error hidden></p>
      <div class="sheet__actions">
        <button class="btn btn--ghost" value="cancel" formnovalidate>Cancelar</button>
        <button class="btn btn--primary" value="save" data-item-save>Guardar</button>
      </div>
    </form>
  </dialog>

  <!-- Movement form -->
  <dialog class="sheet" data-move-dialog aria-labelledby="move-title">
    <form method="dialog" class="sheet__form" data-move-form novalidate>
      <h2 id="move-title" data-move-title>Movimiento</h2>
      <input type="hidden" name="id">
      <fieldset class="seg">
        <legend class="sr">Tipo de movimiento</legend>
        <label><input type="radio" name="type" value="in" checked><span>Entrada</span></label>
        <label><input type="radio" name="type" value="out"><span>Salida</span></label>
        <label><input type="radio" name="type" value="adjust"><span>Ajuste (recuento)</span></label>
      </fieldset>
      <label><span data-qty-label>Cantidad</span><input name="qty" type="text" inputmode="decimal" pattern="[0-9]+([.,][0-9]{1,3})?" autocomplete="off" required></label>
      <label>Nota (opcional)<input name="note" maxlength="140" placeholder="Proveedor, merma, recuento…"></label>
      <p class="hint" data-move-hint></p>
      <p class="msg msg--error" data-move-error hidden></p>
      <div class="sheet__actions">
        <button class="btn btn--ghost" value="cancel" formnovalidate>Cancelar</button>
        <button class="btn btn--primary" value="save" data-move-save>Registrar</button>
      </div>
    </form>
  </dialog>

  <div class="toast" role="status" aria-live="polite" data-toast></div>
  <script src="admin.js?v=20261012" defer></script>
<?php endif; ?>
</body>
</html>
