import { getUserKey } from './accountService.js';
import { getStorage, setStorage } from '../utils/storage.js';

const ADDRESSES_KEY = 'lasen_addresses';

export function getAddresses() {
  return getStorage(getUserKey(ADDRESSES_KEY), []);
}

export function saveAddresses(addresses) {
  const hasDefault = addresses.some(address => address.isDefault);
  if (addresses.length > 0 && !hasDefault) {
    addresses[0].isDefault = true;
  }
  setStorage(getUserKey(ADDRESSES_KEY), addresses);
}
