<?php
/**
 * Liberar meta protegido (campos com "_") via REST — Palestras Públicas (CEMANET)
 *
 * Autoriza, pela REST API, a edição dos campos Jet Engine cujo nome começa
 * com "_" — que o WordPress trata como protegidos e bloqueia por padrão.
 * Destinado ao FluentSnippets (executar em todos os lugares).
 *
 * Thiago Mourão — https://github.com/MouraoBSB — 01/06/2026
 */
add_action('init', function () {
    $tipo   = 'palestra_publica';
    $campos = ['_slides'];

    $autorizar = function ($permitido, $chave, $post_id, $user_id) {
        return user_can($user_id, 'edit_posts');
    };

    foreach ($campos as $campo) {
        add_filter("auth_post_meta_{$campo}", $autorizar, 99, 4);
        add_filter("auth_post_{$tipo}_meta_{$campo}", $autorizar, 99, 4);
    }
}, 99);
