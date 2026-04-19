import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import VennView from '@/views/VennView.vue';
import AgesView from '@/views/AgesView.vue';

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
  {
    path: '/ages',
    name: 'ages',
    component: AgesView,
  },
  {
    path: '/genre',
    redirect: { name: 'venn' },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
