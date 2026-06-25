import React from 'react';
import clsx from 'clsx';

const ShellColumnFrame = ({ as: Tag = 'div', className, children, ...rest }) => (
  <Tag className={clsx('shell-column-frame', className)} {...rest}>
    <div className="shell-column-frame__border" aria-hidden="true" />
    <div className="shell-column-frame__shadow" aria-hidden="true" />
    {children}
  </Tag>
);

export default ShellColumnFrame;