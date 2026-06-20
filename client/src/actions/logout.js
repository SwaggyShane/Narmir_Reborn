import { apiCall } from '../utils/api';

export const logout = async () => {
  await apiCall('POST', '/api/auth/logout');
  location.href = '/portal';
};
