/**
 * 社区便民留言板 - 前端脚本
 */
document.addEventListener('DOMContentLoaded', function() {
    // 滚动信息复制实现无缝滚动
    const scrollContent = document.getElementById('scrollContent');
    if (scrollContent) {
        scrollContent.innerHTML += scrollContent.innerHTML;
    }
});

/**
 * 切换收藏状态
 */
function toggleFavorite(event, btn) {
    event.preventDefault();
    event.stopPropagation();

    const messageId = btn.dataset.messageId;
    if (!messageId) return;

    const icon = btn.querySelector('.favorite-icon');
    const text = btn.querySelector('.favorite-text');
    const originalIcon = icon.textContent;
    const originalText = text.textContent;
    const originalClass = btn.className;

    btn.disabled = true;

    const formData = new FormData();
    formData.append('message_id', messageId);
    formData.append('action', 'toggle');

    fetch('api/favorite.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(result => {
        if (result.code === 0) {
            if (result.data.favorited) {
                btn.classList.add('favorited');
                btn.classList.remove('btn-secondary');
                btn.classList.add('btn-warning');
                icon.textContent = '⭐';
                text.textContent = '已收藏';
                showToast(result.msg, 'success');
            } else {
                btn.classList.remove('favorited');
                btn.classList.remove('btn-warning');
                btn.classList.add('btn-secondary');
                icon.textContent = '☆';
                text.textContent = '收藏';
                showToast(result.msg, 'info');

                if (window.location.pathname.includes('favorites.php')) {
                    const card = btn.closest('.message-card');
                    if (card) {
                        card.style.transition = 'all 0.3s ease';
                        card.style.opacity = '0';
                        card.style.transform = 'translateX(-100px)';
                        setTimeout(() => {
                            card.remove();
                            updateFavoritesStats(result.data);
                            handleFavoritesAfterRemove(result.data);
                        }, 300);
                    } else {
                        updateFavoritesStats(result.data);
                    }
                }
            }
        } else {
            showToast(result.msg || '操作失败', 'error');
            icon.textContent = originalIcon;
            text.textContent = originalText;
            btn.className = originalClass;
        }
    })
    .catch(error => {
        console.error('收藏操作失败:', error);
        showToast('网络错误，请稍后重试', 'error');
        icon.textContent = originalIcon;
        text.textContent = originalText;
        btn.className = originalClass;
    })
    .finally(() => {
        btn.disabled = false;
    });
}

/**
 * 更新收藏页面统计数据（只更新总数和被取消项所属的分类，避免分类数字残留/丢失）
 */
function updateFavoritesStats(data) {
    const stats = (data && data.stats) || null;
    if (!stats) return;

    const mapping = {
        total: stats.total,
        help: stats.help,
        suggest: stats.suggest,
        lost: stats.lost
    };

    document.querySelectorAll('.favorites-stats [data-stat]').forEach(el => {
        const key = el.dataset.stat;
        if (mapping[key] !== undefined) {
            const numEl = el.querySelector('.stat-number');
            if (numEl) numEl.textContent = mapping[key];
        }
    });

    const subtitle = document.querySelector('.page-subtitle');
    if (subtitle) {
        subtitle.textContent = `共收藏 ${stats.total} 条留言`;
    }
}

/**
 * 取消收藏后处理收藏页列表：
 * - 页内仍有卡片：只移除卡片即可
 * - 当前页变空但其他页还有数据：跳到最近的有效页（保留当前分类筛选）
 * - 所有收藏都为空：才显示空态
 */
function handleFavoritesAfterRemove(data) {
    const list = document.querySelector('.message-list');
    if (!list) return;

    const stats = (data && data.stats) || {};
    const remainingCards = list.querySelectorAll('.message-card');

    // 页内还有卡片，布局不会错位，无需跳转
    if (remainingCards.length > 0) return;

    const params = new URLSearchParams(window.location.search);
    const currentType = ['help', 'suggest', 'lost'].includes(params.get('type')) ? params.get('type') : '';

    const filterCount = currentType
        ? (stats[currentType] !== undefined ? stats[currentType] : 0)
        : (stats.total || 0);

    // 全部收藏为空（或当前筛选下为空且其他分类也没有）→ 进入空态
    if ((stats.total || 0) === 0) {
        showFavoritesEmptyState();
        return;
    }

    // 当前分类被取消完但其他分类还有收藏，回退到“全部”列表
    if (filterCount === 0) {
        window.location.assign('favorites.php');
        return;
    }

    // 当前筛选还有数据但本页空了：回到最近的有效页
    const pageSize = 10;
    const lastPage = Math.max(1, Math.ceil(filterCount / pageSize));
    const currentPage = parseInt(params.get('page'), 10) || 1;
    if (currentPage > lastPage) {
        const query = new URLSearchParams();
        query.set('page', String(lastPage));
        if (currentType) query.set('type', currentType);
        window.location.assign('favorites.php?' + query.toString());
    } else {
        // 理论上不会发生；兜底重载，由服务端钳制到正确页码
        window.location.reload();
    }
}

/**
 * 显示收藏页空态
 */
function showFavoritesEmptyState() {
    const container = document.querySelector('.message-list-section .container');
    if (!container) return;

    // 旧分页与列表随空态一并移除，避免残留元素造成错位
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">⭐</div>
            <p>暂无收藏的留言</p>
            <a href="index.php" class="btn btn-primary">去浏览留言</a>
        </div>
    `;
}

/**
 * 显示提示消息
 */
function showToast(message, type = 'info') {
    const existingToast = document.querySelector('.toast-message');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;
    toast.textContent = message;

    const styles = {
        position: 'fixed',
        top: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '12px 24px',
        borderRadius: '8px',
        color: '#fff',
        fontSize: '0.9rem',
        zIndex: '9999',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        animation: 'slideDown 0.3s ease',
        maxWidth: '90%',
        textAlign: 'center'
    };

    const typeColors = {
        success: 'background: #10b981',
        error: 'background: #ef4444',
        info: 'background: #3b82f6',
        warning: 'background: #f59e0b'
    };

    Object.assign(toast.style, styles);
    toast.style.cssText += ';' + (typeColors[type] || typeColors.info);

    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
        @keyframes slideDown {
            from { opacity: 0; transform: translate(-50%, -20px); }
            to { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
    `;
    document.head.appendChild(styleSheet);

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 2000);
}

/**
 * 打开举报弹窗
 */
function openReportModal(messageId) {
    const modal = document.getElementById('reportModal');
    if (!modal) return;

    document.getElementById('reportMessageId').value = messageId;
    document.getElementById('reportForm').reset();
    document.getElementById('reportDescCount').textContent = '0';
    modal.style.display = 'flex';
}

/**
 * 关闭举报弹窗
 */
function closeReportModal() {
    const modal = document.getElementById('reportModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * 初始化举报表单
 */
function initReportForm() {
    const form = document.getElementById('reportForm');
    if (!form) return;

    const descInput = document.getElementById('reportDescription');
    const descCount = document.getElementById('reportDescCount');

    if (descInput && descCount) {
        descInput.addEventListener('input', function() {
            descCount.textContent = this.value.length;
        });
    }

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        submitReport();
    });

    document.getElementById('reportModal').addEventListener('click', function(e) {
        if (e.target === this) closeReportModal();
    });
}

/**
 * 提交举报
 */
function submitReport() {
    const form = document.getElementById('reportForm');
    if (!form) return;

    const submitBtn = document.getElementById('reportSubmitBtn');
    const messageId = document.getElementById('reportMessageId').value;
    const reportType = form.querySelector('input[name="report_type"]:checked');
    const description = document.getElementById('reportDescription').value;

    if (!reportType) {
        showToast('请选择举报类型', 'warning');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '提交中...';

    const formData = new FormData();
    formData.append('message_id', messageId);
    formData.append('report_type', reportType.value);
    formData.append('description', description);
    formData.append('action', 'submit');

    fetch('api/report.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(result => {
        if (result.code === 0) {
            showToast(result.msg, 'success');
            closeReportModal();

            const reportBtn = document.querySelector('.report-btn[data-message-id="' + messageId + '"]');
            if (reportBtn) {
                reportBtn.disabled = true;
                reportBtn.classList.remove('btn-danger');
                reportBtn.classList.add('btn-secondary');
                const reportText = reportBtn.querySelector('.report-text');
                if (reportText) {
                    reportText.textContent = '已举报';
                }
            }
        } else {
            showToast(result.msg || '举报失败', 'error');
        }
    })
    .catch(error => {
        console.error('举报提交失败:', error);
        showToast('网络错误，请稍后重试', 'error');
    })
    .finally(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = '提交举报';
    });
}

document.addEventListener('DOMContentLoaded', function() {
    initReportForm();
});

/**
 * 从浏览器往返缓存（bfcache）恢复页面时强制重新加载，
 * 避免后退进入时卡片收藏状态、统计数字停留在旧快照
 */
window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        window.location.reload();
    }
});
