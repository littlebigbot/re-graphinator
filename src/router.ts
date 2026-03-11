import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import VennView from '@/views/VennView.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: { name: 'venn' },
  },
  {
    path: '/venn',
    name: 'venn',
    component: VennView,
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
