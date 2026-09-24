<?php
require_once __DIR__ . '/includes/functions.php';
require_once __DIR__ . '/config/database.php';

$pageTitle = '我的收藏 - 社区便民留言板';
$currentPage = 'favorites';
$cssPath = 'assets/css/style.css';
$jsPath = 'assets/js/main.js';

$db = getDB();
$visitorId = getVisitorId();

$type = $_GET['type'] ?? '';
$page = max(1, intval($_GET['page'] ?? 1));
$pageSize = 10;

// 统计始终基于全部收藏（不受筛选影响），保证分类入口数字与各列表口径一致
$stats = getFavoriteStats($visitorId);

// 当前筛选下没有任何收藏、但其他分类还有收藏时，回退到“全部”，避免误显示空态
if ($type && in_array($type, ['help', 'suggest', 'lost']) && $stats[$type] === 0 && $stats['total'] > 0) {
    header('Location: favorites.php');
    exit;
}

$where = "WHERE f.visitor_id = ? AND m.status = 1";
$params = [$visitorId];

if ($type && in_array($type, ['help', 'suggest', 'lost'])) {
    $where .= " AND m.type = ?";
    $params[] = $type;
}

$countSql = "SELECT COUNT(*) FROM favorites f INNER JOIN messages m ON f.message_id = m.id $where";
$countStmt = $db->prepare($countSql);
$countStmt->execute($params);
$total = (int) $countStmt->fetchColumn();
$totalPages = max(1, (int) ceil($total / $pageSize));

// 页码超出最近有效页（例如最后一条被取消收藏）时，回到最近的有效页，
// 只有收藏确实全部为空才允许进入空态
if ($page > $totalPages && $total > 0) {
    $query = http_build_query(array_filter(['page' => $totalPages, 'type' => $type]));
    header('Location: favorites.php?' . $query);
    exit;
}
$page = min($page, $totalPages);
$offset = ($page - 1) * $pageSize;

$sql = "SELECT m.id, m.nickname, m.type, m.title, m.content, m.image, m.views, m.created_at, f.created_at as favorited_at
        FROM favorites f
        INNER JOIN messages m ON f.message_id = m.id
        $where
        ORDER BY f.created_at DESC
        LIMIT $pageSize OFFSET $offset";
$stmt = $db->prepare($sql);
$stmt->execute($params);
$favorites = $stmt->fetchAll();

include __DIR__ . '/includes/header.php';
?>

<section class="favorites-section">
    <div class="container">
        <div class="page-header">
            <h1 class="page-title">⭐ 我的收藏</h1>
            <p class="page-subtitle">共收藏 <?= (int) $stats['total'] ?> 条留言</p>
        </div>

        <div class="favorites-stats">
            <a href="favorites.php" class="stat-card stat-link <?= !$type ? 'active' : '' ?>" data-stat="total">
                <div class="stat-number"><?= $stats['total'] ?></div>
                <div class="stat-label">全部收藏</div>
            </a>
            <a href="favorites.php?type=help" class="stat-card stat-help stat-link <?= $type === 'help' ? 'active' : '' ?>" data-stat="help">
                <div class="stat-number"><?= $stats['help'] ?></div>
                <div class="stat-label">🆘 求助</div>
            </a>
            <a href="favorites.php?type=suggest" class="stat-card stat-suggest stat-link <?= $type === 'suggest' ? 'active' : '' ?>" data-stat="suggest">
                <div class="stat-number"><?= $stats['suggest'] ?></div>
                <div class="stat-label">💡 建议</div>
            </a>
            <a href="favorites.php?type=lost" class="stat-card stat-lost stat-link <?= $type === 'lost' ? 'active' : '' ?>" data-stat="lost">
                <div class="stat-number"><?= $stats['lost'] ?></div>
                <div class="stat-label">🔍 失物</div>
            </a>
        </div>

        <div class="filter-section">
            <div class="filter-types">
                <a href="favorites.php" class="filter-tag <?= !$type ? 'active' : '' ?>">全部</a>
                <a href="favorites.php?type=help" class="filter-tag <?= $type === 'help' ? 'active' : '' ?>">🆘 求助</a>
                <a href="favorites.php?type=suggest" class="filter-tag <?= $type === 'suggest' ? 'active' : '' ?>">💡 建议</a>
                <a href="favorites.php?type=lost" class="filter-tag <?= $type === 'lost' ? 'active' : '' ?>">🔍 失物招领</a>
            </div>
        </div>
    </div>
</section>

<section class="message-list-section">
    <div class="container">
        <?php if (empty($favorites)): ?>
        <div class="empty-state">
            <div class="empty-icon">⭐</div>
            <p>暂无收藏的留言</p>
            <a href="index.php" class="btn btn-primary">去浏览留言</a>
        </div>
        <?php else: ?>
        <div class="message-list">
            <?php foreach ($favorites as $msg): ?>
            <div class="message-card">
                <a href="detail.php?id=<?= $msg['id'] ?>" class="card-link">
                    <div class="card-header">
                        <span class="card-type type-<?= $msg['type'] ?>"><?= getTypeIcon($msg['type']) ?> <?= getTypeLabel($msg['type']) ?></span>
                        <span class="card-time">收藏于 <?= timeAgo($msg['favorited_at']) ?></span>
                    </div>
                    <h3 class="card-title"><?= cleanInput($msg['title']) ?></h3>
                    <p class="card-content"><?= cleanInput(mb_substr($msg['content'], 0, 80)) ?><?= mb_strlen($msg['content']) > 80 ? '...' : '' ?></p>
                    <div class="card-footer">
                        <span class="card-author">👤 <?= cleanInput($msg['nickname']) ?></span>
                        <?php if ($msg['image']): ?>
                        <span class="card-image">📷 有图</span>
                        <?php endif; ?>
                        <span class="card-views">👁 <?= $msg['views'] ?></span>
                    </div>
                </a>
                <button class="favorite-btn favorited" data-message-id="<?= $msg['id'] ?>" data-type="<?= $msg['type'] ?>" onclick="toggleFavorite(event, this)">
                    <span class="favorite-icon">⭐</span>
                    <span class="favorite-text">已收藏</span>
                </button>
            </div>
            <?php endforeach; ?>
        </div>

        <?php if ($totalPages > 1): ?>
        <div class="pagination">
            <?php if ($page > 1): ?>
            <a href="favorites.php?page=<?= $page - 1 ?>&type=<?= $type ?>" class="page-btn">上一页</a>
            <?php endif; ?>
            <?php for ($i = max(1, $page - 2); $i <= min($totalPages, $page + 2); $i++): ?>
            <a href="favorites.php?page=<?= $i ?>&type=<?= $type ?>" class="page-btn <?= $i === $page ? 'active' : '' ?>"><?= $i ?></a>
            <?php endfor; ?>
            <?php if ($page < $totalPages): ?>
            <a href="favorites.php?page=<?= $page + 1 ?>&type=<?= $type ?>" class="page-btn">下一页</a>
            <?php endif; ?>
        </div>
        <?php endif; ?>
        <?php endif; ?>
    </div>
</section>

<?php include __DIR__ . '/includes/footer.php'; ?>
