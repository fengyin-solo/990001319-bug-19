<?php
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(405, '不支持的请求方式');
}

$messageId = intval($_POST['message_id'] ?? 0);
$action = $_POST['action'] ?? 'toggle';

if ($messageId <= 0) {
    jsonResponse(1, '无效的留言ID');
}

$db = getDB();

$stmt = $db->prepare("SELECT id, type FROM messages WHERE id = ? AND status = 1");
$stmt->execute([$messageId]);
$message = $stmt->fetch();
if (!$message) {
    jsonResponse(1, '留言不存在或未通过审核');
}

try {
    if ($action === 'check') {
        $favorited = isFavorited($messageId);
        jsonResponse(0, '查询成功', ['favorited' => $favorited]);
    } else {
        $result = toggleFavorite($messageId);
        // 返回留言类型与最新收藏统计，供前端只更新对应分类，避免数字残留
        $result['message_type'] = $message['type'];
        $result['stats'] = getFavoriteStats();
        $msg = $result['action'] === 'add' ? '收藏成功' : '已取消收藏';
        jsonResponse(0, $msg, $result);
    }
} catch (Exception $e) {
    jsonResponse(500, '操作失败，请稍后重试');
}
